import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn() }));
vi.mock("../services/api", () => ({ api: http }));

describe("Check-in and PDC real API mode", () => {
  beforeEach(() => { vi.resetModules(); vi.stubEnv("VITE_USE_MOCKS", "false"); vi.clearAllMocks(); });

  it("uses tenant-protected checklist and damage endpoints without companyId", async () => {
    http.get.mockResolvedValue({ data: { workOrder: {}, checkIn: {} } });
    http.put.mockResolvedValue({ data: { result: { id: "r" } } });
    http.post.mockResolvedValue({ data: { damage: { id: "d" } } });
    const { workshopApi } = await import("../services/workshop");
    await workshopApi.getCheckIn("order-a");
    await workshopApi.saveResult("order-a", "item-a", { status: "ISSUE", note: "Observado" });
    await workshopApi.createDamage("order-a", { location: "HOOD", damageType: "DENT", severity: "MODERATE", description: null });
    expect(http.get).toHaveBeenCalledWith("/work-orders/order-a/check-in/workspace");
    expect(http.put.mock.calls[0][1]).not.toHaveProperty("companyId");
    expect(http.post.mock.calls[0][1]).not.toHaveProperty("companyId");
    expect(http.post.mock.calls[0][1]).not.toHaveProperty("observedByUserId");
  });

  it("uses PDC endpoints without technician or tenant supplied by the UI", async () => {
    http.post.mockResolvedValue({ data: { pdc: { id: "p" }, finding: { id: "f" } } });
    const { workshopApi } = await import("../services/workshop");
    await workshopApi.createPdc("order-a", { mileage: 100 });
    await workshopApi.addFinding("order-a", { category: "BRAKES", status: "ISSUE", severity: "HIGH", description: "Desgaste", recommendation: null, requiresImmediateAttention: true });
    expect(http.post.mock.calls[0][1]).not.toHaveProperty("companyId");
    expect(http.post.mock.calls[0][1]).not.toHaveProperty("technicianUserId");
    expect(http.post.mock.calls[1][1]).not.toHaveProperty("createdByUserId");
  });
});
