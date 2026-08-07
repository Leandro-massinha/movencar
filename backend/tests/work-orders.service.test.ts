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
  vehicleHistoryEvent: { create: vi.fn() },
  vehicleOdometerReading: { create: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock("../src/lib/prisma.js", () => ({ prisma: db }));

import {
  closeWorkOrder,
  completeCheckIn,
  createCheckIn,
  createConcern,
  createWorkOrder,
  getWorkOrder,
  listConcerns,
  listWorkOrders,
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
    db.branch.findFirst.mockResolvedValue({ id: "branch-a" });
    db.customer.findFirst.mockResolvedValue({ id: "customer-a" });
    db.vehicle.findFirst.mockResolvedValue({ id: "vehicle-a" });
    db.workOrderSequence.upsert.mockResolvedValue({ lastValue: 1842 });
    db.workOrder.create.mockResolvedValue(order);
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

describe("immutable customer concerns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
    db.workOrder.update.mockResolvedValue({
      concernCounter: 2,
      vehicleId: "vehicle-a",
      branchId: "branch-a",
    });
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
});

describe("documentary check-in", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockImplementation(async (callback: (tx: typeof db) => unknown) => callback(db));
    db.workOrder.findFirst.mockResolvedValue({
      id: "order-a",
      companyId: "company-a",
      branchId: "branch-a",
      customerId: "customer-a",
      vehicleId: "vehicle-a",
    });
    db.vehicleCheckIn.create.mockResolvedValue({
      id: "check-in-a",
      status: "DRAFT",
    });
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
  });

  it("allows edits only while draft", async () => {
    db.vehicleCheckIn.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      updateCheckIn(actor, "order-a", { generalNotes: "Alteração" }),
    ).rejects.toMatchObject({ code: "CHECK_IN_NOT_EDITABLE" });
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
