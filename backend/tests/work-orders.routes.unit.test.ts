import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync(
  new URL("../src/modules/work-orders/work-orders.routes.ts", import.meta.url),
  "utf8",
);

describe("work order route authorization", () => {
  it("requires authentication and Workshop entitlement", () => {
    expect(routes).toContain("workOrdersRouter.use(authenticate)");
    expect(routes).toContain('requireModule("workshop")');
  });

  it("uses granular permissions for implemented operations", () => {
    for (const permission of [
      "work_orders.view",
      "work_orders.create",
      "work_orders.close",
      "customer_concerns.create",
      "checkins.view",
      "checkins.create",
      "checkins.update",
      "checkins.complete",
      "pdc.view",
      "pdc.create",
      "pdc.update",
      "pdc.complete",
    ])
      expect(routes).toContain(permission);
  });

  it("keeps private Check-in evidence contextual and permission-bound", () => {
    expect(routes).toContain('/:id/check-in/evidence"');
    expect(routes).toContain(
      '/:id/check-in/evidence/:evidenceId/content"',
    );
    expect(routes).toContain('requirePermission("checkins.view")');
    expect(routes).toContain('requirePermission("checkins.update")');
    expect(routes).not.toContain('/api/files/:id');
    for (const header of [
      "Content-Type",
      "Content-Length",
      "Content-Disposition",
      "private, no-store",
      "nosniff",
    ])
      expect(routes).toContain(header);
  });
});
