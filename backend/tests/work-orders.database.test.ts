import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/prisma.js";
import {
  closeWorkOrder,
  completeCheckIn,
  createCheckIn,
  createWorkOrder,
  type WorkOrderActor,
} from "../src/modules/work-orders/work-orders.service.js";

const databaseTests = process.env.WORK_ORDER_DATABASE_TESTS === "1";
const suite = databaseTests ? describe : describe.skip;

suite("work order PostgreSQL concurrency", () => {
  const companyId = randomUUID();
  const branchId = randomUUID();
  const userId = randomUUID();
  const customerId = randomUUID();
  const vehicleId = randomUUID();
  const actor: WorkOrderActor = { companyId, branchId, userId };

  beforeAll(async () => {
    await prisma.company.create({
      data: {
        id: companyId,
        code: `audit-${companyId}`,
        legalName: "MovenCar Audit",
        tradeName: "MovenCar Audit",
      },
    });
    await prisma.branch.create({
      data: { id: branchId, companyId, code: "AUDIT", name: "Auditoria" },
    });
    await prisma.user.create({
      data: {
        id: userId,
        companyId,
        defaultBranchId: branchId,
        name: "Auditor",
        email: `audit-${userId}@example.invalid`,
        passwordHash: "not-used",
      },
    });
    await prisma.customer.create({
      data: { id: customerId, companyId, name: "Cliente Auditoria" },
    });
    await prisma.vehicle.create({
      data: {
        id: vehicleId,
        companyId,
        customerId,
        brand: "MovenCar",
        model: "Audit",
        currentMileage: 50_000,
      },
    });
  });

  afterAll(async () => prisma.$disconnect());

  it("allocates 100 unique monotonic numbers under concurrency", async () => {
    const orders = await Promise.all(
      Array.from({ length: 100 }, () =>
        createWorkOrder(actor, {
          customerId,
          vehicleId,
          purpose: "DIAGNOSTIC",
        }),
      ),
    );
    const numbers = orders.map(({ number }) => number);

    expect(new Set(numbers).size).toBe(100);
    expect(Math.min(...numbers)).toBeGreaterThan(0);
    expect(await prisma.workOrderSequence.findUnique({ where: { companyId } })).toMatchObject({
      lastValue: Math.max(...numbers),
    });
  }, 30_000);

  it("returns one order for a concurrent idempotent double-submit", async () => {
    const operationKey = `audit:${randomUUID()}`;
    const [first, second] = await Promise.all([
      createWorkOrder(
        actor,
        { customerId, vehicleId, purpose: "EVALUATION" },
        operationKey,
      ),
      createWorkOrder(
        actor,
        { customerId, vehicleId, purpose: "EVALUATION" },
        operationKey,
      ),
    ]);

    expect(first.id).toBe(second.id);
    expect(
      await prisma.workOrder.count({ where: { companyId, operationKey } }),
    ).toBe(1);
    expect(
      await prisma.vehicleHistoryEvent.count({
        where: { companyId, sourceId: first.id, eventType: "WORK_ORDER_OPENED" },
      }),
    ).toBe(1);
  });

  it("allows only one competing terminal transition", async () => {
    const order = await createWorkOrder(actor, {
      customerId,
      vehicleId,
      purpose: "REPAIR",
    });
    const results = await Promise.allSettled([
      closeWorkOrder(actor, order.id, { outcome: "COMPLETED" }),
      closeWorkOrder(actor, order.id, {
        outcome: "NO_SERVICE",
        closingReason: "PRICE",
      }),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(
      await prisma.vehicleHistoryEvent.count({
        where: {
          companyId,
          sourceId: order.id,
          eventType: { in: ["WORK_ORDER_COMPLETED", "WORK_ORDER_CLOSED_NO_SERVICE"] },
        },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { companyId, entityId: order.id, action: "WORK_ORDER_CLOSE" },
      }),
    ).toBe(1);
  });

  it("completes one check-in once and keeps mileage projection monotonic", async () => {
    const [high, low] = await Promise.all([
      createWorkOrder(actor, {
        customerId,
        vehicleId,
        purpose: "INSPECTION",
        mileageAtEntry: 55_000,
      }),
      createWorkOrder(actor, {
        customerId,
        vehicleId,
        purpose: "INSPECTION",
        mileageAtEntry: 52_000,
      }),
    ]);
    expect(high.id).not.toBe(low.id);
    expect(
      await prisma.vehicle.findUnique({
        where: { id: vehicleId },
        select: { currentMileage: true },
      }),
    ).toEqual({ currentMileage: 55_000 });

    const order = await createWorkOrder(actor, {
      customerId,
      vehicleId,
      purpose: "INSPECTION",
    });
    const checkIn = await createCheckIn(actor, order.id, { mileage: 55_000 });
    const results = await Promise.allSettled([
      completeCheckIn(actor, order.id),
      completeCheckIn(actor, order.id),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(
      await prisma.vehicleOdometerReading.count({
        where: { companyId, source: "CHECK_IN" },
      }),
    ).toBe(1);
    expect(
      await prisma.vehicleHistoryEvent.count({
        where: { companyId, sourceId: checkIn.id, eventType: "CHECK_IN_COMPLETED" },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: { companyId, entityId: checkIn.id, action: "CHECK_IN_COMPLETE" },
      }),
    ).toBe(1);
  });
});
