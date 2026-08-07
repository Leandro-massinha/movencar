import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  new URL(
    "../prisma/migrations/20260809120000_add_intake_work_order_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("intake database foundation", () => {
  it("enforces friendly numbers, idempotency and valid closing states", () => {
    expect(sql).toContain("WorkOrder_companyId_number_key");
    expect(sql).toContain("WorkOrder_companyId_operationKey_key");
    expect(sql).toContain("WorkOrder_closing_state_check");
    expect(sql).toContain('"status" = \'CLOSED_NO_SERVICE\'');
  });

  it("binds work order, check-in and identities through tenant-safe FKs", () => {
    expect(sql).toContain(
      'FOREIGN KEY ("vehicleId", "companyId") REFERENCES "Vehicle"("id", "companyId")',
    );
    expect(sql).toContain(
      'FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId")',
    );
    expect(sql).toContain(
      'FOREIGN KEY ("workOrderId", "companyId", "branchId", "customerId", "vehicleId")',
    );
    expect(sql).not.toContain("ON DELETE CASCADE");
  });

  it("protects documentary and observational values", () => {
    expect(sql).toContain("VehicleCheckIn_state_check");
    expect(sql).toContain("VehicleCheckIn_fuel_level_check");
    expect(sql).toContain("VehicleCheckIn_mileage_check");
    expect(sql).toContain("CustomerConcern_description_check");
  });

  it("installs only permissions backed by functional endpoints", () => {
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
      expect(sql).toContain(permission);
    expect(sql).not.toContain("work_orders.update");
    expect(sql).not.toContain("checkins.confirm");
  });
});
