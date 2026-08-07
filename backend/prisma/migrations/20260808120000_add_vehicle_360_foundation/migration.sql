CREATE TYPE "VehicleOwnershipType" AS ENUM ('OWNER', 'FLEET', 'DRIVER', 'RESPONSIBLE', 'LEASED', 'OTHER');
CREATE TYPE "VehicleOdometerSource" AS ENUM ('VEHICLE', 'VEHICLE_HISTORY', 'SERVICE_VISIT', 'CHECK_IN', 'WORK_ORDER', 'INSPECTION', 'DELIVERY', 'MANUAL', 'INTEGRATION');

CREATE TABLE "VehicleOwnershipHistory" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "createdByUserId" UUID,
    "ownershipType" "VehicleOwnershipType" NOT NULL DEFAULT 'OWNER',
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3),
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleOwnershipHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VehicleOwnershipHistory_valid_period_check" CHECK ("validUntil" IS NULL OR "validUntil" >= "validFrom"),
    CONSTRAINT "VehicleOwnershipHistory_current_period_check" CHECK (("isCurrent" AND "validUntil" IS NULL) OR (NOT "isCurrent" AND "validUntil" IS NOT NULL))
);

CREATE TABLE "VehicleOdometerReading" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "branchId" UUID,
    "userId" UUID,
    "mileage" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "source" "VehicleOdometerSource" NOT NULL,
    "sourceId" VARCHAR(100),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleOdometerReading_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VehicleOdometerReading_mileage_check" CHECK ("mileage" >= 0)
);

CREATE UNIQUE INDEX "VehicleOwnershipHistory_id_companyId_key" ON "VehicleOwnershipHistory"("id", "companyId");
CREATE UNIQUE INDEX "VehicleOwnershipHistory_one_current_owner" ON "VehicleOwnershipHistory"("companyId", "vehicleId") WHERE "isCurrent" = true AND "ownershipType" = 'OWNER';
CREATE INDEX "VehicleOwnershipHistory_companyId_vehicleId_validFrom_idx" ON "VehicleOwnershipHistory"("companyId", "vehicleId", "validFrom");
CREATE INDEX "VehicleOwnershipHistory_companyId_customerId_validFrom_idx" ON "VehicleOwnershipHistory"("companyId", "customerId", "validFrom");
CREATE UNIQUE INDEX "VehicleOdometerReading_id_companyId_key" ON "VehicleOdometerReading"("id", "companyId");
CREATE INDEX "VehicleOdometerReading_companyId_vehicleId_recordedAt_idx" ON "VehicleOdometerReading"("companyId", "vehicleId", "recordedAt");
CREATE INDEX "VehicleOdometerReading_companyId_source_sourceId_idx" ON "VehicleOdometerReading"("companyId", "source", "sourceId");

ALTER TABLE "VehicleOwnershipHistory" ADD CONSTRAINT "VehicleOwnershipHistory_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleOwnershipHistory" ADD CONSTRAINT "VehicleOwnershipHistory_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "Vehicle"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleOwnershipHistory" ADD CONSTRAINT "VehicleOwnershipHistory_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleOwnershipHistory" ADD CONSTRAINT "VehicleOwnershipHistory_createdByUserId_companyId_fkey" FOREIGN KEY ("createdByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "Vehicle"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleOdometerReading" ADD CONSTRAINT "VehicleOdometerReading_userId_companyId_fkey" FOREIGN KEY ("userId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "VehicleOwnershipHistory" ("id", "companyId", "vehicleId", "customerId", "ownershipType", "validFrom", "isCurrent", "createdAt")
SELECT gen_random_uuid(), v."companyId", v."id", v."customerId", 'OWNER', v."createdAt", true, CURRENT_TIMESTAMP
FROM "Vehicle" v;

INSERT INTO "VehicleOdometerReading" ("id", "companyId", "vehicleId", "branchId", "mileage", "recordedAt", "source", "sourceId", "notes", "createdAt")
SELECT gen_random_uuid(), v."companyId", v."id", v."originBranchId", v."currentMileage", v."createdAt", 'VEHICLE', v."id", 'Leitura inicial migrada do cadastro do veículo.', CURRENT_TIMESTAMP
FROM "Vehicle" v
WHERE v."currentMileage" IS NOT NULL;
