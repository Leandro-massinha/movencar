-- Older VEHICLE readings used the vehicle itself as sourceId, which is not
-- unique across multiple legitimate readings. Give each existing reading a
-- stable operation identity before enforcing idempotency for future writes.
UPDATE "VehicleOdometerReading"
SET "sourceId" = "id"::text
WHERE "source" = 'VEHICLE' AND "sourceId" IS NOT NULL;

CREATE UNIQUE INDEX "VehicleOdometerReading_source_operation_key"
ON "VehicleOdometerReading"("companyId", "source", "sourceId")
WHERE "sourceId" IS NOT NULL;
