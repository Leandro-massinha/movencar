import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260808120000_add_vehicle_360_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const hardeningMigration = readFileSync(
  new URL(
    "../prisma/migrations/20260808150000_harden_vehicle_360_consistency/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("vehicle 360 database invariants", () => {
  it("enforces one current owner and valid ownership periods", () => {
    expect(migration).toContain("VehicleOwnershipHistory_one_current_owner");
    expect(migration).toContain('WHERE "isCurrent" = true');
    expect(migration).toContain("VehicleOwnershipHistory_valid_period_check");
    expect(migration).toContain("VehicleOwnershipHistory_current_period_check");
  });

  it("uses compound tenant-safe foreign keys", () => {
    expect(migration).toContain(
      'FOREIGN KEY ("vehicleId", "companyId") REFERENCES "Vehicle"("id", "companyId")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId")',
    );
    expect(migration).toContain(
      'FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId")',
    );
  });

  it("rejects negative odometer readings and backfills current summaries", () => {
    expect(migration).toContain(
      'VehicleOdometerReading_mileage_check" CHECK ("mileage" >= 0)',
    );
    expect(migration).toContain('INSERT INTO "VehicleOwnershipHistory"');
    expect(migration).toContain('INSERT INTO "VehicleOdometerReading"');
  });

  it("deduplicates odometer operations by tenant, source and sourceId", () => {
    expect(hardeningMigration).toContain(
      'SET "sourceId" = "id"::text',
    );
    expect(hardeningMigration).toContain(
      'VehicleOdometerReading_source_operation_key',
    );
    expect(hardeningMigration).toContain(
      'ON "VehicleOdometerReading"("companyId", "source", "sourceId")',
    );
  });
});
