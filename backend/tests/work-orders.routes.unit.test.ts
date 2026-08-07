import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync(
  new URL(
    "../src/modules/work-orders/work-orders.routes.ts",
    import.meta.url,
  ),
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
    ])
      expect(routes).toContain(permission);
  });
});
