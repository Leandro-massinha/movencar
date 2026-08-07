CREATE TYPE "WorkOrderPurpose" AS ENUM ('DIAGNOSTIC', 'EVALUATION', 'MAINTENANCE', 'REPAIR', 'INSPECTION', 'REVISION', 'WARRANTY', 'COURTESY', 'RETURN', 'OTHER');
CREATE TYPE "WorkOrderStatus" AS ENUM ('OPEN', 'CANCELLED', 'CLOSED_NO_SERVICE', 'CLOSED');
CREATE TYPE "WorkOrderClosingReason" AS ENUM ('PRICE', 'POSTPONED', 'NO_AUTHORIZATION', 'PART_UNAVAILABLE', 'CUSTOMER_WITHDREW', 'VEHICLE_REMOVED', 'SECOND_OPINION', 'OTHER');
CREATE TYPE "CustomerConcernPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
CREATE TYPE "VehicleCheckInStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CONFIRMED', 'CANCELLED');

ALTER TYPE "VehicleHistoryEventType" ADD VALUE 'WORK_ORDER_OPENED';
ALTER TYPE "VehicleHistoryEventType" ADD VALUE 'CUSTOMER_CONCERN_RECORDED';
ALTER TYPE "VehicleHistoryEventType" ADD VALUE 'CHECK_IN_COMPLETED';
ALTER TYPE "VehicleHistoryEventType" ADD VALUE 'WORK_ORDER_CLOSED_NO_SERVICE';
ALTER TYPE "VehicleHistoryEventType" ADD VALUE 'WORK_ORDER_COMPLETED';
ALTER TYPE "VehicleHistoryEventType" ADD VALUE 'WORK_ORDER_CANCELLED';

CREATE TABLE "WorkOrderSequence" (
  "companyId" UUID NOT NULL,
  "lastValue" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrderSequence_pkey" PRIMARY KEY ("companyId"),
  CONSTRAINT "WorkOrderSequence_positive_check" CHECK ("lastValue" >= 0)
);

CREATE TABLE "WorkOrder" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "attendantUserId" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "purpose" "WorkOrderPurpose" NOT NULL,
  "status" "WorkOrderStatus" NOT NULL DEFAULT 'OPEN',
  "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "mileageAtEntry" INTEGER,
  "notes" TEXT,
  "closingReason" "WorkOrderClosingReason",
  "closingNotes" TEXT,
  "operationKey" VARCHAR(120),
  "concernCounter" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WorkOrder_number_check" CHECK ("number" > 0),
  CONSTRAINT "WorkOrder_mileage_check" CHECK ("mileageAtEntry" IS NULL OR "mileageAtEntry" >= 0),
  CONSTRAINT "WorkOrder_concern_counter_check" CHECK ("concernCounter" >= 0),
  CONSTRAINT "WorkOrder_closing_state_check" CHECK (
    ("status" = 'OPEN' AND "closedAt" IS NULL AND "closingReason" IS NULL) OR
    ("status" = 'CLOSED_NO_SERVICE' AND "closedAt" IS NOT NULL AND "closingReason" IS NOT NULL) OR
    ("status" IN ('CLOSED', 'CANCELLED') AND "closedAt" IS NOT NULL)
  )
);

CREATE TABLE "CustomerConcern" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "workOrderId" UUID NOT NULL,
  "reportedByUserId" UUID NOT NULL,
  "description" TEXT NOT NULL,
  "category" VARCHAR(80),
  "priority" "CustomerConcernPriority" NOT NULL DEFAULT 'NORMAL',
  "symptomStartedAt" TIMESTAMP(3),
  "frequency" VARCHAR(120),
  "condition" VARCHAR(240),
  "notes" TEXT,
  "sequence" INTEGER NOT NULL,
  "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerConcern_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerConcern_sequence_check" CHECK ("sequence" > 0),
  CONSTRAINT "CustomerConcern_description_check" CHECK (length(btrim("description")) > 0)
);

CREATE TABLE "VehicleCheckIn" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "workOrderId" UUID NOT NULL,
  "vehicleId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "status" "VehicleCheckInStatus" NOT NULL DEFAULT 'DRAFT',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "mileage" INTEGER,
  "fuelLevel" INTEGER,
  "deliveredBy" VARCHAR(180),
  "generalNotes" TEXT,
  "templateVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VehicleCheckIn_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VehicleCheckIn_mileage_check" CHECK ("mileage" IS NULL OR "mileage" >= 0),
  CONSTRAINT "VehicleCheckIn_fuel_level_check" CHECK ("fuelLevel" IS NULL OR "fuelLevel" BETWEEN 0 AND 100),
  CONSTRAINT "VehicleCheckIn_template_version_check" CHECK ("templateVersion" >= 1),
  CONSTRAINT "VehicleCheckIn_state_check" CHECK (
    ("status" = 'DRAFT' AND "completedAt" IS NULL AND "confirmedAt" IS NULL) OR
    ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL AND "confirmedAt" IS NULL) OR
    ("status" = 'CONFIRMED' AND "completedAt" IS NOT NULL AND "confirmedAt" IS NOT NULL) OR
    ("status" = 'CANCELLED' AND "confirmedAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "WorkOrder_id_companyId_key" ON "WorkOrder"("id", "companyId");
CREATE UNIQUE INDEX "WorkOrder_intake_identity_key" ON "WorkOrder"("id", "companyId", "branchId", "customerId", "vehicleId");
CREATE UNIQUE INDEX "WorkOrder_companyId_number_key" ON "WorkOrder"("companyId", "number");
CREATE UNIQUE INDEX "WorkOrder_companyId_operationKey_key" ON "WorkOrder"("companyId", "operationKey");
CREATE INDEX "WorkOrder_companyId_status_openedAt_idx" ON "WorkOrder"("companyId", "status", "openedAt");
CREATE INDEX "WorkOrder_companyId_vehicleId_openedAt_idx" ON "WorkOrder"("companyId", "vehicleId", "openedAt");
CREATE INDEX "WorkOrder_companyId_customerId_openedAt_idx" ON "WorkOrder"("companyId", "customerId", "openedAt");
CREATE INDEX "WorkOrder_companyId_branchId_openedAt_idx" ON "WorkOrder"("companyId", "branchId", "openedAt");
CREATE UNIQUE INDEX "CustomerConcern_id_companyId_key" ON "CustomerConcern"("id", "companyId");
CREATE UNIQUE INDEX "CustomerConcern_companyId_workOrderId_sequence_key" ON "CustomerConcern"("companyId", "workOrderId", "sequence");
CREATE INDEX "CustomerConcern_companyId_workOrderId_reportedAt_idx" ON "CustomerConcern"("companyId", "workOrderId", "reportedAt");
CREATE UNIQUE INDEX "VehicleCheckIn_id_companyId_key" ON "VehicleCheckIn"("id", "companyId");
CREATE UNIQUE INDEX "VehicleCheckIn_work_order_key" ON "VehicleCheckIn"("workOrderId", "companyId", "branchId", "customerId", "vehicleId");
CREATE INDEX "VehicleCheckIn_companyId_vehicleId_startedAt_idx" ON "VehicleCheckIn"("companyId", "vehicleId", "startedAt");
CREATE INDEX "VehicleCheckIn_companyId_status_startedAt_idx" ON "VehicleCheckIn"("companyId", "status", "startedAt");

ALTER TABLE "WorkOrderSequence" ADD CONSTRAINT "WorkOrderSequence_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "Vehicle"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_attendantUserId_companyId_fkey" FOREIGN KEY ("attendantUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerConcern" ADD CONSTRAINT "CustomerConcern_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerConcern" ADD CONSTRAINT "CustomerConcern_workOrderId_companyId_fkey" FOREIGN KEY ("workOrderId", "companyId") REFERENCES "WorkOrder"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerConcern" ADD CONSTRAINT "CustomerConcern_reportedByUserId_companyId_fkey" FOREIGN KEY ("reportedByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleCheckIn" ADD CONSTRAINT "VehicleCheckIn_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleCheckIn" ADD CONSTRAINT "VehicleCheckIn_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleCheckIn" ADD CONSTRAINT "VehicleCheckIn_work_order_fkey" FOREIGN KEY ("workOrderId", "companyId", "branchId", "customerId", "vehicleId") REFERENCES "WorkOrder"("id", "companyId", "branchId", "customerId", "vehicleId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleCheckIn" ADD CONSTRAINT "VehicleCheckIn_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "Vehicle"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleCheckIn" ADD CONSTRAINT "VehicleCheckIn_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VehicleCheckIn" ADD CONSTRAINT "VehicleCheckIn_createdByUserId_companyId_fkey" FOREIGN KEY ("createdByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Permission" ("id", "code", "description")
SELECT gen_random_uuid(), p.code, p.description
FROM (VALUES
  ('work_orders.view', 'Consultar ordens de serviço'),
  ('work_orders.create', 'Criar ordens de serviço'),
  ('work_orders.close', 'Encerrar ordens de serviço'),
  ('customer_concerns.create', 'Registrar relatos do cliente'),
  ('checkins.view', 'Consultar check-ins'),
  ('checkins.create', 'Criar check-ins'),
  ('checkins.update', 'Atualizar check-ins em rascunho'),
  ('checkins.complete', 'Concluir check-ins')
) AS p(code, description)
WHERE NOT EXISTS (SELECT 1 FROM "Permission" existing WHERE existing.code = p.code);

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
JOIN "Permission" p ON p.code IN ('work_orders.view','work_orders.create','work_orders.close','customer_concerns.create','checkins.view','checkins.create','checkins.update','checkins.complete')
WHERE r.code IN ('ADMIN', 'MANAGER')
ON CONFLICT DO NOTHING;
