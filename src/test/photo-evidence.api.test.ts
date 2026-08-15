import { beforeEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("../services/api", () => ({ api: http }));

describe("API real de evidências fotográficas", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_USE_MOCKS", "false");
    vi.clearAllMocks();
  });

  it("usa endpoints gerais com multipart e download autenticado como Blob", async () => {
    const evidence = { id: "foto-1" };
    const blob = new Blob(["foto"], { type: "image/jpeg" });
    http.get
      .mockResolvedValueOnce({ data: { data: [evidence] } })
      .mockResolvedValueOnce({ data: blob });
    http.post.mockResolvedValue({ data: { evidence } });
    http.delete.mockResolvedValue({});
    const { photoEvidenceApi } = await import("../services/photoEvidence");
    const file = new File(["foto"], "vistoria.jpg", { type: "image/jpeg" });

    await photoEvidenceApi.listCheckIn("os-1");
    await photoEvidenceApi.uploadCheckIn("os-1", {
      file,
      caption: "Dianteira",
      category: "FRONT",
    });
    await expect(photoEvidenceApi.getCheckInContent("os-1", "foto-1")).resolves.toBe(blob);
    await photoEvidenceApi.deleteCheckIn("os-1", "foto-1");

    expect(http.get).toHaveBeenNthCalledWith(1, "/work-orders/os-1/check-in/evidence");
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      "/work-orders/os-1/check-in/evidence/foto-1/content",
      { responseType: "blob" },
    );
    const body = http.post.mock.calls[0][1] as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.get("caption")).toBe("Dianteira");
    expect(body.get("category")).toBe("FRONT");
    expect([...body.keys()]).not.toContain("companyId");
    expect(http.delete).toHaveBeenCalledWith(
      "/work-orders/os-1/check-in/evidence/foto-1",
    );
  });

  it("usa endpoints contextuais de avaria sem categoria ou dados internos", async () => {
    const evidence = { id: "foto-2" };
    const blob = new Blob(["foto"], { type: "image/png" });
    http.get
      .mockResolvedValueOnce({ data: { data: [evidence] } })
      .mockResolvedValueOnce({ data: blob });
    http.post.mockResolvedValue({ data: { evidence } });
    http.delete.mockResolvedValue({});
    const { photoEvidenceApi } = await import("../services/photoEvidence");
    const file = new File(["foto"], "avaria.png", { type: "image/png" });

    await photoEvidenceApi.listDamage("os-1", "avaria-1");
    await photoEvidenceApi.uploadDamage("os-1", "avaria-1", {
      file,
      caption: "Risco",
    });
    await photoEvidenceApi.getDamageContent("os-1", "avaria-1", "foto-2");
    await photoEvidenceApi.deleteDamage("os-1", "avaria-1", "foto-2");

    expect(http.get).toHaveBeenNthCalledWith(
      1,
      "/work-orders/os-1/check-in/damages/avaria-1/evidence",
    );
    expect(http.get).toHaveBeenNthCalledWith(
      2,
      "/work-orders/os-1/check-in/damages/avaria-1/evidence/foto-2/content",
      { responseType: "blob" },
    );
    const body = http.post.mock.calls[0][1] as FormData;
    expect([...body.keys()]).toEqual(["file", "caption"]);
    expect(http.delete).toHaveBeenCalledWith(
      "/work-orders/os-1/check-in/damages/avaria-1/evidence/foto-2",
    );
  });
});
