import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import {
  completeCheckIn,
  completePdc,
  createCheckIn,
  createDamage,
  createPdc,
  createPdcFinding,
  getCheckInWorkspace,
  getPdcWorkspace,
  saveChecklistResult,
  updatePdc,
  type WorkOrderActor,
} from "../src/modules/work-orders/work-orders.service.js";

const suite =
  process.env.CHECKIN_PDC_DATABASE_TESTS === "1" ? describe : describe.skip;

suite("Check-in, damage map and PDC PostgreSQL invariants", () => {
  const companyId = randomUUID(),
    companyBId = randomUUID(),
    branchId = randomUUID(),
    branchBId = randomUUID(),
    userId = randomUUID();
  const customerId = randomUUID(),
    vehicleId = randomUUID(),
    workOrderId = randomUUID();
  const actor: WorkOrderActor = { companyId, branchId, userId };

  beforeAll(async () => {
    await prisma.company.createMany({
      data: [
        {
          id: companyId,
          code: `check-${companyId}`,
          legalName: "Empresa A",
          tradeName: "Empresa A",
        },
        {
          id: companyBId,
          code: `check-${companyBId}`,
          legalName: "Empresa B",
          tradeName: "Empresa B",
        },
      ],
    });
    await prisma.branch.createMany({
      data: [
        { id: branchId, companyId, code: "A", name: "Filial A" },
        { id: branchBId, companyId: companyBId, code: "B", name: "Filial B" },
      ],
    });
    await prisma.user.create({
      data: {
        id: userId,
        companyId,
        defaultBranchId: branchId,
        name: "Técnico",
        email: `${userId}@example.invalid`,
        passwordHash: "x",
      },
    });
    await prisma.customer.create({
      data: {
        id: customerId,
        companyId,
        type: "INDIVIDUAL",
        name: "Cliente",
        document: "52998224725",
      },
    });
    await prisma.vehicle.create({
      data: {
        id: vehicleId,
        companyId,
        customerId,
        brand: "Marca",
        model: "Modelo",
        currentMileage: 40000,
      },
    });
    await prisma.workOrder.create({
      data: {
        id: workOrderId,
        companyId,
        branchId,
        customerId,
        vehicleId,
        attendantUserId: userId,
        number: 1,
        purpose: "DIAGNOSTIC",
      },
    });
  });
  afterAll(async () => prisma.$disconnect());

  it("uses the global versioned template and never exposes another tenant", async () => {
    await createCheckIn(actor, workOrderId, { mileage: 42000, fuelLevel: 0 });
    const workspace = await getCheckInWorkspace(companyId, workOrderId);
    expect(workspace.checkIn.checklistInstance?.templateVersion).toBe(1);
    expect(
      workspace.checkIn.checklistInstance?.template.sections.length,
    ).toBeGreaterThan(5);
    await expect(
      getCheckInWorkspace(companyBId, workOrderId),
    ).rejects.toMatchObject({ status: 404 });
    const custom = await prisma.checklistTemplate.create({
      data: {
        companyId,
        name: "Check-in específico A",
        type: "CHECK_IN",
        version: 1,
        isDefault: true,
        isSystem: false,
        sections: {
          create: {
            title: "Seção A",
            order: 1,
            items: {
              create: {
                title: "Item A",
                responseType: "STATUS",
                order: 1,
                isRequired: true,
              },
            },
          },
        },
      },
    });
    const secondOrderId = randomUUID();
    await prisma.workOrder.create({
      data: {
        id: secondOrderId,
        companyId,
        branchId,
        customerId,
        vehicleId,
        attendantUserId: userId,
        number: 2,
        purpose: "INSPECTION",
      },
    });
    await createCheckIn(actor, secondOrderId, { fuelLevel: 100 });
    expect(
      (await getCheckInWorkspace(companyId, secondOrderId)).checkIn
        .checklistInstance?.template.id,
    ).toBe(custom.id);
    expect(
      await prisma.checklistTemplate.count({
        where: { companyId: companyBId },
      }),
    ).toBe(0);
  });

  it("persists every explicit state and requires all mandatory answers", async () => {
    const workspace = await getCheckInWorkspace(companyId, workOrderId);
    const items =
      workspace.checkIn.checklistInstance!.template.sections.flatMap(
        (section) => section.items,
      );
    const statuses = ["OK", "ISSUE", "NOT_CHECKED", "NOT_APPLICABLE"] as const;
    for (const [index, item] of items.entries()) {
      if (!item.isRequired && index > 3) continue;
      if (item.responseType === "NUMBER")
        await saveChecklistResult(actor, workOrderId, item.id, {
          numericValue: 42000,
        });
      else if (item.responseType === "SELECT")
        await saveChecklistResult(actor, workOrderId, item.id, {
          selectedValue: "0",
        });
      else if (item.responseType === "TEXT")
        await saveChecklistResult(actor, workOrderId, item.id, {
          textValue: "Sem observações",
        });
      else
        await saveChecklistResult(actor, workOrderId, item.id, {
          status: statuses[index % statuses.length],
          note: index % statuses.length === 1 ? "Anormalidade observada" : null,
        });
    }
    expect(
      await prisma.checklistItemResult.count({ where: { companyId } }),
    ).toBeGreaterThan(20);
  });

  it("makes damage retries idempotent and rejects changes after completion", async () => {
    const input = {
      location: "HOOD" as const,
      damageType: "DENT" as const,
      severity: "MODERATE" as const,
      description: "Amassado visível",
    };
    const [a, b] = await Promise.all([
      createDamage(actor, workOrderId, input, "damage:retry:1"),
      createDamage(actor, workOrderId, input, "damage:retry:1"),
    ]);
    expect(a.id).toBe(b.id);
    expect(
      await prisma.checkInDamage.count({ where: { companyId, workOrderId } }),
    ).toBe(1);
    const completions = await Promise.allSettled([
      completeCheckIn(actor, workOrderId),
      completeCheckIn(actor, workOrderId),
    ]);
    expect(
      completions.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await prisma.vehicleHistoryEvent.count({
        where: { companyId, vehicleId, eventType: "CHECK_IN_COMPLETED" },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.vehicle.findFirstOrThrow({
          where: { id: vehicleId, companyId },
        })
      ).currentMileage,
    ).toBe(42000);
    await expect(createDamage(actor, workOrderId, input)).rejects.toMatchObject(
      { code: "CHECK_IN_NOT_EDITABLE" },
    );
  });

  it("allows one active PDC, multiple findings and one concurrent completion", async () => {
    const creations = await Promise.allSettled([
      createPdc(actor, workOrderId, { mileage: 41900 }, "pdc:create:1"),
      createPdc(actor, workOrderId, { mileage: 42100 }, "pdc:create:2"),
    ]);
    expect(
      creations.filter((result) => result.status === "fulfilled").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      await prisma.preliminaryVehicleDiagnostic.count({
        where: { companyId, workOrderId, status: { not: "CANCELLED" } },
      }),
    ).toBe(1);
    await createPdcFinding(actor, workOrderId, {
      category: "BRAKES",
      status: "ISSUE",
      severity: "HIGH",
      description: "Desgaste inicial",
      recommendation: "Inspecionar freios",
      requiresImmediateAttention: true,
    });
    await createPdcFinding(actor, workOrderId, {
      category: "TIRES",
      status: "ISSUE",
      severity: "MEDIUM",
      description: "Desgaste irregular",
      recommendation: "Verificar alinhamento",
      requiresImmediateAttention: false,
    });
    const completions = await Promise.allSettled([
      completePdc(actor, workOrderId),
      completePdc(actor, workOrderId),
    ]);
    expect(
      completions.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      await prisma.vehicleHistoryEvent.count({
        where: { companyId, vehicleId, eventType: "PDC_COMPLETED" },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { companyId, action: "PDC_COMPLETE" },
      }),
    ).toBe(1);
    await expect(
      updatePdc(actor, workOrderId, { generalNotes: "Alteração tardia" }),
    ).rejects.toMatchObject({ code: "PDC_NOT_EDITABLE" });
    await expect(
      getPdcWorkspace(companyBId, workOrderId),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (
        await prisma.vehicle.findFirstOrThrow({
          where: { id: vehicleId, companyId },
        })
      ).currentMileage,
    ).toBeGreaterThanOrEqual(42000);
  });
});
