import request from "supertest";
import express from "express";
import { describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { requirePermission } from "../src/modules/auth/auth.middleware.js";
import { contentDisposition } from "../src/modules/work-orders/work-orders.routes.js";

describe("autorização e headers de evidências do Check-in", () => {
  it("rejeita usuário não autenticado antes de acessar o recurso", async () => {
    const app = createApp();
    const workOrderId = "00000000-0000-4000-8000-000000000001";
    const evidenceId = "00000000-0000-4000-8000-000000000002";
    for (const call of [
      request(app).get(`/api/work-orders/${workOrderId}/check-in/evidence`),
      request(app).get(
        `/api/work-orders/${workOrderId}/check-in/evidence/${evidenceId}/content`,
      ),
      request(app).delete(
        `/api/work-orders/${workOrderId}/check-in/evidence/${evidenceId}`,
      ),
      request(app).put(
        `/api/work-orders/${workOrderId}/check-in/checklist/items/${evidenceId}`,
      ),
    ]) {
      await call
        .expect(401)
        .expect(({ body }) => expect(body.error.code).toBe("AUTH_REQUIRED"));
    }
  });

  it.each(["checkins.view", "checkins.update"])(
    "rejeita ausência da permissão %s",
    (permission) => {
      const next = vi.fn();
      requirePermission(permission)(
        { auth: { permissions: [] } } as never,
        {} as never,
        next,
      );
      expect(next.mock.calls[0][0]).toMatchObject({
        status: 403,
        code: "FORBIDDEN",
      });
    },
  );

  it("sanitiza Content-Disposition sem permitir injeção de header", () => {
    const value = contentDisposition('foto"\r\nX-Evil: sim ç.jpg');
    expect(value).toContain("inline; filename=");
    expect(value).toContain("filename*=UTF-8''");
    expect(value).not.toContain("\r");
    expect(value).not.toContain("\n");
    expect(value).not.toContain('foto"');
  });

  it("mantém captura de múltiplos parâmetros após path-to-regexp 0.1.13", async () => {
    const matcher = express();
    matcher.get(
      "/api/work-orders/:workOrderId/check-in/evidence/:evidenceId/content",
      (req, res) => res.json(req.params),
    );
    matcher.delete(
      "/api/work-orders/:workOrderId/check-in/evidence/:evidenceId",
      (req, res) => res.json(req.params),
    );
    const expected = { workOrderId: "ordem-1", evidenceId: "evidencia-2" };
    await request(matcher)
      .get(
        "/api/work-orders/ordem-1/check-in/evidence/evidencia-2/content",
      )
      .expect(200, expected);
    await request(matcher)
      .delete("/api/work-orders/ordem-1/check-in/evidence/evidencia-2")
      .expect(200, expected);
    await request(matcher)
      .get("/api/work-orders/ordem-1/check-in/evidence/evidencia-2/inexistente")
      .expect(404);
  });

  it("preserva query parser extended com objetos e listas", async () => {
    const matcher = express();
    matcher.get("/query", (req, res) => res.json(req.query));
    await request(matcher)
      .get("/query?filter[status]=DRAFT&category[]=FRONT&category[]=REAR")
      .expect(200, {
        filter: { status: "DRAFT" },
        category: ["FRONT", "REAR"],
      });
  });
});
