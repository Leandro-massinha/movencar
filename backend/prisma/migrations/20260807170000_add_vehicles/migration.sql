CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');
CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'ETHANOL', 'FLEX', 'DIESEL', 'ELECTRIC', 'HYBRID', 'GNV', 'OTHER');
CREATE TYPE "TransmissionType" AS ENUM ('MANUAL', 'AUTOMATIC', 'CVT', 'AUTOMATED', 'OTHER');

CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "originBranchId" UUID,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "plate" VARCHAR(7),
    "renavam" VARCHAR(11),
    "chassis" VARCHAR(17),
    "brand" VARCHAR(80) NOT NULL,
    "model" VARCHAR(120) NOT NULL,
    "version" VARCHAR(120),
    "yearManufacture" INTEGER,
    "yearModel" INTEGER,
    "color" VARCHAR(60),
    "fuelType" "FuelType",
    "transmission" "TransmissionType",
    "engine" VARCHAR(80),
    "enginePower" INTEGER,
    "bodyType" VARCHAR(80),
    "doors" INTEGER,
    "currentMileage" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Vehicle_yearManufacture_check" CHECK ("yearManufacture" IS NULL OR "yearManufacture" BETWEEN 1886 AND 2200),
    CONSTRAINT "Vehicle_yearModel_check" CHECK ("yearModel" IS NULL OR "yearModel" BETWEEN 1886 AND 2200),
    CONSTRAINT "Vehicle_mileage_check" CHECK ("currentMileage" IS NULL OR "currentMileage" >= 0),
    CONSTRAINT "Vehicle_doors_check" CHECK ("doors" IS NULL OR "doors" BETWEEN 0 AND 10),
    CONSTRAINT "Vehicle_enginePower_check" CHECK ("enginePower" IS NULL OR "enginePower" BETWEEN 0 AND 5000)
);

CREATE UNIQUE INDEX "Vehicle_id_companyId_key" ON "Vehicle"("id", "companyId");
CREATE INDEX "Vehicle_companyId_customerId_idx" ON "Vehicle"("companyId", "customerId");
CREATE INDEX "Vehicle_companyId_status_idx" ON "Vehicle"("companyId", "status");
CREATE INDEX "Vehicle_companyId_brand_model_idx" ON "Vehicle"("companyId", "brand", "model");
CREATE INDEX "Vehicle_companyId_originBranchId_idx" ON "Vehicle"("companyId", "originBranchId");
CREATE INDEX "Vehicle_companyId_deletedAt_idx" ON "Vehicle"("companyId", "deletedAt");

-- Natural identifiers are unique only for active records in the authenticated tenant.
CREATE UNIQUE INDEX "Vehicle_company_plate_active_key" ON "Vehicle"("companyId", "plate") WHERE "plate" IS NOT NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "Vehicle_company_chassis_active_key" ON "Vehicle"("companyId", "chassis") WHERE "chassis" IS NOT NULL AND "deletedAt" IS NULL;

ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_originBranchId_companyId_fkey" FOREIGN KEY ("originBranchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
