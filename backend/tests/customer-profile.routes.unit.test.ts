import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routes = readFileSync(
  new URL("../src/modules/customers/customers.routes.ts", import.meta.url),
  "utf8",
);
const service = readFileSync(
  new URL("../src/modules/customers/customers.service.ts", import.meta.url),
  "utf8",
);

describe("Customer 360 routes and projections", () => {
  it("keeps authentication, Customers gate and existing permissions", () => {
    expect(routes).toContain("customersRouter.use(authenticate)");
    expect(routes).toContain('requireModule("customers")');
    for (const permission of [
      "customers.view",
      "customers.create",
      "customers.update",
      "customers.delete",
    ])
      expect(routes).toContain(permission);
  });
  it("declares possible duplicates before the dynamic customer route", () => {
    expect(routes.indexOf('"/possible-duplicates"')).toBeLessThan(
      routes.indexOf('"/:id"'),
    );
  });
  it("uses update permission for contact deactivation and validates Idempotency-Key", () => {
    expect(routes).toContain(
      'customersRouter.delete("/:id/contacts/:contactId", requirePermission("customers.update")',
    );
    expect(routes).toContain(
      'customerProfileIdempotencyKeySchema.parse(req.get("idempotency-key"))',
    );
  });
  it("uses a list projection without birth, fiscal registration or notes", () => {
    const projection = service.slice(
      service.indexOf("const customerListSelect"),
      service.indexOf("const addressSelect"),
    );
    expect(projection).not.toContain("birthDate");
    expect(projection).not.toContain("stateRegistration");
    expect(projection).not.toContain("notes");
  });
});
