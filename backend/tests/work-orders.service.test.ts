import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  branch: { findFirst: vi.fn() },
  customer: { findFirst: vi.fn() },
  vehicle: { findFirst: vi.fn(), updateMany: vi.fn() },
  workOrderSequence: { upsert: vi.fn() },
  workOrder: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  customerConcern: { findMany: vi.fn(), create: vi.fn() },
  vehicleCheckIn: {
    findFirst: vi.fn(),
    findFirstOrThrow: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  checklistTemplate: { findFirst: vi.fn() },
  checklistInstance: {
    findFirst: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
  },
  checklistTemplateItem: { count: vi.fn(), findFirst: vi.fn() },
  checklistItemResult: { upsert: vi.fn() },
  checkInDamage: { findFirst: vi.fn(), create: vi.fn() },
  preliminaryVehicleDiagnostic: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  pdcFinding: {
    create: vi.fn(),
    updateMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  vehicleHistoryEvent: { create: vi.fn() },
  vehicleOdometerReading: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("../src/lib/prisma.js", () => ({ prisma: db }));

import {
  closeWorkOrder,
  completeCheckIn,
  completePdc,
  createCheckIn,
  createConcern,
  createDamage,
  createPdc,
  createPdcFinding,
  createWorkOrder,
  getWorkOrder,
  listConcerns,
  listWorkOrders,
  saveChecklistResult,
  updateCheckIn,
  type WorkOrderActor,
} from "../src/modules/work-orders/work-orders.service.js";

const actor: WorkOrderActor = {
  companyId: "company-a",
  branchId: "branch-a",
  userId: "user-a",
};
const order = {
  id: "order-a",
  number: 1842,
  purpose: "DIAGNOSTIC",
  status: "OPEN",
  openedAt: new Date(),
  mileageAtEntry: null,
  notes: null,
  vehicle: { id: "vehicle-a" },
  customer: { id: "customer-a" },
  branch: { id: "branch-a" },
};

describe("work order intake security and consistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(
      async (input: ((tx: typeof db) => unknown) | unknown[]) =>
        Array.isArray(input) ? Promise.all(input) : input(db),
    );
    db.$queryRaw.mockResolvedValue([{ id: "locked" }]);
    db.branch.findFirst.mockResolvedValue({ id: "branch-a" });
    db.customer.findFirst.mockResolvedValue({ id: "customer-a" });
    db.vehicle.findFirst.mockResolvedValue({ id: "vehicle-a" });
    db.workOrderSequence.upsert.mockResolvedValue({ lastValue: 1842 });
    db.workOrder.create.mockResolvedValue(order);
    db.workOrder.findFirst.mockResolvedValue(order);
    db.vehicleHistoryEvent.create.mockResolvedValue({ id: "history-a" });
  });

  it("derives company, attendant and friendly number when creating", async () => {
    await createWorkOrder(actor, {
      customerId: "customer-a",
      vehicleId: "vehicle-a",
      purpose: "DIAGNOSTIC",
    });
    expect(db.workOrderSequence.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { companyId: "company-a" } }),
    );
    expect(db.workOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-a",
          attendantUserId: "user-a",
          number: 1842,
        }),
      }),
    );
  });

  it("rejects customer, vehicle and branch from another tenant", async () => {
    db.branch.findFirst.mockResolvedValueOnce(null);
    await expect(
      createWorkOrder(actor, {
        branchId: "branch-b",
        customerId: "customer-a",
        vehicleId: "vehicle-a",
        purpose: "DIAGNOSTIC",
      }),
    ).rejects.toMatchObject({ code: "BRANCH_NOT_FOUND" });
    db.branch.findFirst.mockResolvedValueOnce({ id: "branch-a" });
    db.customer.findFirst.mockResolvedValueOnce(null);
    await expect(
      createWorkOrder(actor, {
        customerId: "customer-b",
        vehicleId: "vehicle-a",
        purpose: "DIAGNOSTIC",
      }),
    ).rejects.toMatchObject({ code: "CUSTOMER_NOT_FOUND" });
    db.customer.findFirst.mockResolvedValueOnce({ id: "customer-a" });
    db.vehicle.findFirst.mockResolvedValueOnce(null);
    await expect(
      createWorkOrder(actor, {
        customerId: "customer-a",
        vehicleId: "vehicle-b",
        purpose: "DIAGNOSTIC",
      }),
    ).rejects.toMatchObject({ code: "VEHICLE_NOT_FOUND" });
  });

  it("returns the same intake for an idempotency retry", async () => {
    db.workOrder.findFirst.mockResolvedValueOnce(order);
    await expect(
      createWorkOrder(
        actor,
        {
          customerId: "customer-a",
          vehicleId: "vehicle-a",
          purpose: "DIAGNOSTIC",
        },
        "intake:device:123",
      ),
    ).resolves.toEqual(order);
    expect(db.workOrder.create).not.toHaveBeenCalled();
  });

  it("rejects reuse of an idempotency key with another payload", async () => {
    db.workOrder.findFirst.mockResolvedValueOnce(order);

    await expect(
      createWorkOrder(
        actor,
        {
          customerId: "customer-a",
          vehicleId: "vehicle-a",
          purpose: "REPAIR",
        },
        "intake:device:123",
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
    expect(db.workOrder.create).not.toHaveBeenCalled();
  });

  it("records entry mileage once and only raises the projection", async () => {
    await createWorkOrder(actor, {
      customerId: "customer-a",
      vehicleId: "vehicle-a",
      purpose: "DIAGNOSTIC",
      mileageAtEntry: 55000,
    });
    expect(db.vehicleOdometerReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-a",
        mileage: 55000,
        source: "WORK_ORDER",
        sourceId: "history-a",
      }),
    });
    expect(db.vehicle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: "company-a" }),
      }),
    );
  });

  it("does not expose tenant, idempotency or customer PII internals", async () => {
    await createWorkOrder(actor, {
      customerId: "customer-a",
      vehicleId: "vehicle-a",
      purpose: "DIAGNOSTIC",
    });
    const select = db.workOrder.create.mock.calls[0][0].select;
    expect(select.companyId).toBeUndefined();
    expect(select.operationKey).toBeUndefined();
    expect(select.concernCounter).toBeUndefined();
    expect(select.customer.select.document).toBeUndefined();
  });

  it("keeps timeline and audit in the same transaction", async () => {
    db.vehicleHistoryEvent.create.mockRejectedValueOnce(
      new Error("timeline unavailable"),
    );

    await expect(
      createWorkOrder(actor, {
        customerId: "customer-a",
        vehicleId: "vehicle-a",
        purpose: "DIAGNOSTIC",
      }),
    ).rejects.toThrow("timeline unavailable");

    expect(db.auditLog.create).not.toHaveBeenCalled();
  });

  it("keeps list and read tenant-safe with max pagination inputs", async () => {
    db.workOrder.findMany.mockResolvedValue([]);
    db.workOrder.count.mockResolvedValue(0);
    await listWorkOrders("company-a", { page: 2, limit: 100 });
    expect(db.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: "company-a" }),
        skip: 100,
        take: 100,
      }),
    );
    db.workOrder.findFirst.mockResolvedValueOnce(null);
    await expect(getWorkOrder("company-b", "order-a")).rejects.toMatchObject({
      status: 404,
    });
  });

  it("closes without service and preserves reason, timeline and audit", async () => {
    db.workOrder.updateMany.mockResolvedValue({ count: 1 });
    db.workOrder.findFirstOrThrow.mockResolvedValue({
      ...order,
      status: "CLOSED_NO_SERVICE",
    });
    await closeWorkOrder(actor, "order-a", {
      outcome: "NO_SERVICE",
      closingReason: "PRICE",
    });
    expect(db.workOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-a", companyId: "company-a", status: "OPEN" },
        data: expect.objectContaining({
          status: "CLOSED_NO_SERVICE",
          closingReason: "PRICE",
        }),
      }),
    );
    expect(db.vehicleHistoryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "WORK_ORDER_CLOSED_NO_SERVICE",
        }),
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "WORK_ORDER_CLOSE" }),
    });
  });

  it("closes a completed work order with the normal terminal event", async () => {
    db.workOrder.updateMany.mockResolvedValue({ count: 1 });
    db.workOrder.findFirstOrThrow.mockResolvedValue({
      ...order,
      status: "CLOSED",
    });

    await closeWorkOrder(actor, "order-a", { outcome: "COMPLETED" });

    expect(db.workOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "order-a", companyId: "company-a", status: "OPEN" },
        data: expect.objectContaining({ status: "CLOSED" }),
      }),
    );
    expect(db.vehicleHistoryEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "WORK_ORDER_COMPLETED" }),
      }),
    );
  });

  it("does not reveal a cross-tenant work order through close", async () => {
    db.workOrder.findFirst.mockResolvedValueOnce(null);

    await expect(
      closeWorkOrder({ ...actor, companyId: "company-b" }, "order-a", {
        outcome: "COMPLETED",
      }),
    ).rejects.toMatchObject({ status: 404, code: "WORK_ORDER_NOT_FOUND" });
    expect(db.workOrder.updateMany).not.toHaveBeenCalled();
  });

  it("uses CAS so concurrent close does not duplicate effects", async () => {
    db.workOrder.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      closeWorkOrder(actor, "order-a", {
        outcome: "NO_SERVICE",
        closingReason: "POSTPONED",
      }),
    ).rejects.toMatchObject({ code: "WORK_ORDER_NOT_OPEN" });
    expect(db.vehicleHistoryEvent.create).not.toHaveBeenCalled();
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("functional checklist, damage map and PDC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(
      async (callback: (tx: typeof db) => unknown) => callback(db),
    );
    db.$queryRaw.mockResolvedValue([{ id: "locked" }]);
    db.checklistInstance.findFirst.mockResolvedValue({
      id: "instance-a",
      templateId: "template-a",
    });
    db.checklistTemplateItem.findFirst.mockResolvedValue({
      responseType: "STATUS",
      allowNotes: true,
      options: null,
    });
    db.checklistItemResult.upsert.mockResolvedValue({
      id: "result-a",
      itemId: "item-a",
      status: "ISSUE",
    });
  });

  it.each(["OK", "ISSUE", "NOT_CHECKED", "NOT_APPLICABLE"] as const)(
    "persists explicit checklist status %s",
    async (status) => {
      await saveChecklistResult(actor, "order-a", "item-a", { status });
      expect(db.checklistItemResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ companyId: "company-a", status }),
        }),
      );
    },
  );

  it("does not interpret an absent response as OK", async () => {
    db.checklistInstance.findFirst.mockResolvedValueOnce(null);
    await expect(
      saveChecklistResult(actor, "order-a", "item-a", { status: "OK" }),
    ).rejects.toMatchObject({ code: "CHECKLIST_NOT_EDITABLE" });
  });

  it("rejects mixed values that do not match the configured response type", async () => {
    await expect(
      saveChecklistResult(actor, "order-a", "item-a", {
        status: "OK",
        numericValue: 10,
      }),
    ).rejects.toMatchObject({ code: "CHECKLIST_RESPONSE_INVALID" });
    expect(db.checklistItemResult.upsert).not.toHaveBeenCalled();
  });

  it("rejects a SELECT value outside the versioned item options", async () => {
    db.checklistTemplateItem.findFirst.mockResolvedValueOnce({
      responseType: "SELECT",
      allowNotes: true,
      options: ["0", "25", "50"],
    });
    await expect(
      saveChecklistResult(actor, "order-a", "item-a", {
        selectedValue: "100",
      }),
    ).rejects.toMatchObject({ code: "CHECKLIST_OPTION_INVALID" });
  });

  it("records damage from the authenticated tenant and session actor", async () => {
    db.vehicleCheckIn.findFirst.mockResolvedValue({
      id: "check-a",
      vehicleId: "vehicle-a",
      branchId: "branch-a",
    });
    db.checkInDamage.create.mockResolvedValue({
      id: "damage-a",
      location: "HOOD",
      damageType: "DENT",
      severity: "MODERATE",
      description: null,
      observedAt: new Date(),
    });
    await createDamage(actor, "order-a", {
      location: "HOOD",
      damageType: "DENT",
      severity: "MODERATE",
      description: null,
    });
    expect(db.checkInDamage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-a",
          observedByUserId: "user-a",
          checkInId: "check-a",
        }),
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "DAMAGE_CREATE" }),
    });
  });

  it("rejects reuse of a damage idempotency key with a different payload", async () => {
    db.checkInDamage.findFirst.mockResolvedValueOnce({
      id: "damage-a",
      location: "HOOD",
      damageType: "DENT",
      severity: "MODERATE",
      description: null,
      observedAt: new Date(),
    });
    await expect(
      createDamage(
        actor,
        "order-a",
        {
          location: "HOOD",
          damageType: "SCRATCH",
          severity: "MINOR",
          description: null,
        },
        "damage:key:1",
      ),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_KEY_REUSED" });
  });

  it("requires a completed check-in before creating PDC", async () => {
    db.preliminaryVehicleDiagnostic.findFirst.mockResolvedValue(null);
    db.workOrder.findFirst.mockResolvedValue({
      branchId: "branch-a",
      vehicleId: "vehicle-a",
    });
    db.vehicleCheckIn.findFirst.mockResolvedValue(null);
    await expect(createPdc(actor, "order-a", {})).rejects.toMatchObject({
      code: "CHECK_IN_NOT_COMPLETED",
    });
  });

  it("creates findings with deterministic sequence and no sensitive text in audit metadata", async () => {
    db.preliminaryVehicleDiagnostic.findFirst.mockResolvedValue({
      id: "pdc-a",
    });
    db.preliminaryVehicleDiagnostic.update.mockResolvedValue({
      findingCounter: 2,
      branchId: "branch-a",
    });
    db.pdcFinding.create.mockResolvedValue({
      id: "finding-a",
      category: "BRAKES",
      severity: "HIGH",
      requiresImmediateAttention: true,
    });
    await createPdcFinding(actor, "order-a", {
      category: "BRAKES",
      status: "ISSUE",
      severity: "HIGH",
      description: "Texto técnico",
      recommendation: "Inspecionar",
      requiresImmediateAttention: true,
    });
    expect(db.pdcFinding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sequence: 2,
          createdByUserId: "user-a",
        }),
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.not.objectContaining({
          description: expect.anything(),
          recommendation: expect.anything(),
        }),
      }),
    });
  });

  it("uses CAS when completing PDC and emits no event for the loser", async () => {
    db.preliminaryVehicleDiagnostic.findFirst.mockResolvedValue({
      id: "pdc-a",
      vehicleId: "vehicle-a",
      branchId: "branch-a",
      mileage: null,
      findingCounter: 1,
    });
    db.preliminaryVehicleDiagnostic.updateMany.mockResolvedValue({ count: 0 });
    await expect(completePdc(actor, "order-a")).rejects.toMatchObject({
      code: "PDC_ALREADY_COMPLETED",
    });
    expect(db.vehicleHistoryEvent.create).not.toHaveBeenCalled();
  });
});

describe("immutable customer concerns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(
      async (callback: (tx: typeof db) => unknown) => callback(db),
    );
    db.workOrder.update.mockResolvedValue({
      concernCounter: 2,
      vehicleId: "vehicle-a",
      branchId: "branch-a",
    });
    db.workOrder.findFirst.mockResolvedValue({ status: "OPEN" });
    db.customerConcern.create.mockResolvedValue({
      id: "concern-a",
      description: "Barulho ao frear.",
      sequence: 2,
      reportedAt: new Date(),
    });
  });

  it("creates multiple ordered reports without an update path", async () => {
    await createConcern(actor, "order-a", {
      description: "Barulho ao frear.",
      priority: "NORMAL",
    });
    expect(db.workOrder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "OPEN" }),
        data: { concernCounter: { increment: 1 } },
      }),
    );
    expect(db.customerConcern.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-a",
          sequence: 2,
          reportedByUserId: "user-a",
        }),
      }),
    );
  });

  it("lists concerns in deterministic original order", async () => {
    db.workOrder.findFirst.mockResolvedValue(order);
    db.customerConcern.findMany.mockResolvedValue([]);
    await listConcerns("company-a", "order-a");
    expect(db.customerConcern.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: "company-a", workOrderId: "order-a" },
        orderBy: [{ sequence: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("does not reveal or mutate a concern aggregate from another tenant", async () => {
    db.workOrder.findFirst.mockResolvedValueOnce(null);

    await expect(
      createConcern({ ...actor, companyId: "company-b" }, "order-a", {
        description: "Problema na suspensão.",
        priority: "NORMAL",
      }),
    ).rejects.toMatchObject({ status: 404, code: "WORK_ORDER_NOT_FOUND" });
    expect(db.workOrder.update).not.toHaveBeenCalled();
    expect(db.customerConcern.create).not.toHaveBeenCalled();
  });
});

describe("documentary check-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(
      async (callback: (tx: typeof db) => unknown) => callback(db),
    );
    db.workOrder.findFirst.mockResolvedValue({
      id: "order-a",
      companyId: "company-a",
      branchId: "branch-a",
      customerId: "customer-a",
      vehicleId: "vehicle-a",
      status: "OPEN",
    });
    db.vehicleCheckIn.create.mockResolvedValue({
      id: "check-in-a",
      status: "DRAFT",
    });
    db.checklistTemplate.findFirst.mockResolvedValue({
      id: "template-a",
      version: 1,
    });
    db.checklistInstance.create.mockResolvedValue({ id: "instance-a" });
    db.checklistInstance.findFirst.mockResolvedValue({
      id: "instance-a",
      templateId: "template-a",
    });
    db.checklistTemplateItem.count.mockResolvedValue(0);
    db.checklistInstance.updateMany.mockResolvedValue({ count: 1 });
  });

  it("derives all tenant relationships from the work order", async () => {
    await createCheckIn(actor, "order-a", { fuelLevel: 50 });
    expect(db.vehicleCheckIn.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: "company-a",
          branchId: "branch-a",
          customerId: "customer-a",
          vehicleId: "vehicle-a",
          workOrderId: "order-a",
          createdByUserId: "user-a",
          fuelLevel: 50,
        }),
      }),
    );
    expect(db.checklistInstance.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        companyId: "company-a",
        checkInId: "check-in-a",
        templateId: "template-a",
        templateVersion: 1,
      }),
    });
  });

  it("allows edits only while draft", async () => {
    db.vehicleCheckIn.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      updateCheckIn(actor, "order-a", { generalNotes: "Alteração" }),
    ).rejects.toMatchObject({ code: "CHECK_IN_NOT_EDITABLE" });
  });

  it("keeps completed, confirmed and cancelled check-ins immutable", async () => {
    for (const status of ["COMPLETED", "CONFIRMED", "CANCELLED"]) {
      db.vehicleCheckIn.updateMany.mockResolvedValueOnce({ count: 0 });
      await expect(
        updateCheckIn(actor, "order-a", { generalNotes: status }),
      ).rejects.toMatchObject({ code: "CHECK_IN_NOT_EDITABLE" });
    }
  });

  it("does not reveal a cross-tenant work order through check-in mutations", async () => {
    db.workOrder.findFirst.mockResolvedValueOnce(null);

    await expect(
      createCheckIn({ ...actor, companyId: "company-b" }, "order-a", {
        fuelLevel: 50,
      }),
    ).rejects.toMatchObject({ status: 404, code: "WORK_ORDER_NOT_FOUND" });
    expect(db.vehicleCheckIn.create).not.toHaveBeenCalled();
  });

  it("completes once and integrates timeline, odometer and audit", async () => {
    db.vehicleCheckIn.findFirst.mockResolvedValue({
      id: "check-in-a",
      vehicleId: "vehicle-a",
      branchId: "branch-a",
      mileage: 52000,
    });
    db.vehicleCheckIn.updateMany.mockResolvedValue({ count: 1 });
    db.vehicleHistoryEvent.create.mockResolvedValue({ id: "history-check-in" });
    db.vehicleCheckIn.findFirstOrThrow.mockResolvedValue({
      id: "check-in-a",
      status: "COMPLETED",
    });
    await completeCheckIn(actor, "order-a");
    expect(db.vehicleOdometerReading.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        source: "CHECK_IN",
        sourceId: "history-check-in",
        mileage: 52000,
      }),
    });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "CHECK_IN_COMPLETE" }),
    });
  });

  it("prevents two concurrent completions", async () => {
    db.vehicleCheckIn.findFirst.mockResolvedValue({
      id: "check-in-a",
      vehicleId: "vehicle-a",
      branchId: "branch-a",
      mileage: null,
    });
    db.vehicleCheckIn.updateMany.mockResolvedValue({ count: 0 });
    await expect(completeCheckIn(actor, "order-a")).rejects.toMatchObject({
      code: "CHECK_IN_ALREADY_COMPLETED",
    });
    expect(db.vehicleHistoryEvent.create).not.toHaveBeenCalled();
  });
});
