CREATE TYPE "VehicleHistoryEventType" AS ENUM ('VEHICLE_CREATED', 'VEHICLE_UPDATED', 'MILEAGE_RECORDED', 'NOTE', 'OWNER_CHANGED', 'GENERAL');
CREATE TYPE "VehicleHistorySourceType" AS ENUM ('MANUAL', 'SYSTEM', 'VEHICLE', 'FUTURE_MODULE');

CREATE UNIQUE INDEX "User_id_companyId_key" ON "User"("id", "companyId");

CREATE TABLE "VehicleHistoryEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "branchId" UUID,
    "actorUserId" UUID,
    "eventType" "VehicleHistoryEventType" NOT NULL,
    "sourceType" "VehicleHistorySourceType" NOT NULL,
    "sourceId" VARCHAR(100),
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "mileage" INTEGER,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VehicleHistoryEvent_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "VehicleHistoryEvent_mileage_check" CHECK ("mileage" IS NULL OR "mileage" BETWEEN 0 AND 100000000)
);

CREATE INDEX "VehicleHistoryEvent_companyId_vehicleId_eventDate_idx" ON "VehicleHistoryEvent"("companyId", "vehicleId", "eventDate");
CREATE INDEX "VehicleHistoryEvent_companyId_vehicleId_eventType_idx" ON "VehicleHistoryEvent"("companyId", "vehicleId", "eventType");

ALTER TABLE "VehicleHistoryEvent" ADD CONSTRAINT "VehicleHistoryEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleHistoryEvent" ADD CONSTRAINT "VehicleHistoryEvent_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "Vehicle"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleHistoryEvent" ADD CONSTRAINT "VehicleHistoryEvent_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleHistoryEvent" ADD CONSTRAINT "VehicleHistoryEvent_actorUserId_companyId_fkey" FOREIGN KEY ("actorUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
