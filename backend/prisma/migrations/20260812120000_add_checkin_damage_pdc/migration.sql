-- CreateEnum
CREATE TYPE "ChecklistTemplateType" AS ENUM ('CHECK_IN', 'PDC', 'ROAD_TEST_INITIAL', 'ROAD_TEST_FINAL', 'DELIVERY', 'MECHANICAL_INSPECTION', 'ELECTRICAL_INSPECTION', 'DETAILING', 'BODY_SHOP', 'TIRES', 'CUSTOM');

ALTER TYPE "VehicleHistoryEventType" ADD VALUE 'DAMAGE_RECORDED';
ALTER TYPE "VehicleHistoryEventType" ADD VALUE 'PDC_STARTED';
ALTER TYPE "VehicleHistoryEventType" ADD VALUE 'PDC_COMPLETED';

-- CreateEnum
CREATE TYPE "ChecklistResponseType" AS ENUM ('STATUS', 'BOOLEAN', 'TEXT', 'NUMBER', 'SELECT', 'MULTI_SELECT', 'MEASUREMENT', 'PHOTO', 'SIGNATURE');

-- CreateEnum
CREATE TYPE "ChecklistObservationStatus" AS ENUM ('OK', 'ISSUE', 'NOT_CHECKED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "ChecklistInstanceStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CheckInDamageLocation" AS ENUM ('FRONT_BUMPER', 'REAR_BUMPER', 'HOOD', 'ROOF', 'TRUNK_LID', 'FRONT_LEFT_FENDER', 'FRONT_RIGHT_FENDER', 'REAR_LEFT_QUARTER', 'REAR_RIGHT_QUARTER', 'FRONT_LEFT_DOOR', 'FRONT_RIGHT_DOOR', 'REAR_LEFT_DOOR', 'REAR_RIGHT_DOOR', 'LEFT_MIRROR', 'RIGHT_MIRROR', 'WINDSHIELD', 'REAR_GLASS', 'LEFT_FRONT_GLASS', 'RIGHT_FRONT_GLASS', 'LEFT_REAR_GLASS', 'RIGHT_REAR_GLASS', 'FRONT_LEFT_WHEEL', 'FRONT_RIGHT_WHEEL', 'REAR_LEFT_WHEEL', 'REAR_RIGHT_WHEEL', 'INTERIOR', 'DASHBOARD', 'TRUNK', 'OTHER');

-- CreateEnum
CREATE TYPE "CheckInDamageType" AS ENUM ('SCRATCH', 'SCUFF', 'DENT', 'CRACK', 'BROKEN', 'MISSING', 'WORN', 'STAIN', 'CHIPPED', 'DAMAGED', 'OTHER');

-- CreateEnum
CREATE TYPE "CheckInDamageSeverity" AS ENUM ('MINOR', 'MODERATE', 'SEVERE');

-- CreateEnum
CREATE TYPE "PreliminaryDiagnosticStatus" AS ENUM ('DRAFT', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PdcFindingCategory" AS ENUM ('BRAKES', 'SUSPENSION', 'STEERING', 'ENGINE', 'TRANSMISSION', 'ELECTRICAL', 'BATTERY', 'TIRES', 'AIR_CONDITIONING', 'FLUIDS', 'BODY', 'INTERIOR', 'SAFETY', 'OTHER');

-- CreateEnum
CREATE TYPE "PdcFindingSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "ChecklistTemplate" (
    "id" UUID NOT NULL,
    "companyId" UUID,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "type" "ChecklistTemplateType" NOT NULL,
    "version" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateSection" (
    "id" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistTemplateItem" (
    "id" UUID NOT NULL,
    "sectionId" UUID NOT NULL,
    "title" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "responseType" "ChecklistResponseType" NOT NULL,
    "order" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "requiresPhoto" BOOLEAN NOT NULL DEFAULT false,
    "photoRequiredOnIssue" BOOLEAN NOT NULL DEFAULT false,
    "allowNotes" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "options" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistInstance" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "checkInId" UUID NOT NULL,
    "templateId" UUID NOT NULL,
    "templateVersion" INTEGER NOT NULL,
    "status" "ChecklistInstanceStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChecklistItemResult" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "instanceId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "status" "ChecklistObservationStatus",
    "textValue" TEXT,
    "numericValue" DECIMAL(14,3),
    "selectedValue" VARCHAR(240),
    "note" TEXT,
    "completedByUserId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChecklistItemResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckInDamage" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "checkInId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "location" "CheckInDamageLocation" NOT NULL,
    "damageType" "CheckInDamageType" NOT NULL,
    "severity" "CheckInDamageSeverity" NOT NULL,
    "description" TEXT,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observedByUserId" UUID NOT NULL,
    "operationKey" VARCHAR(120),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInDamage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreliminaryVehicleDiagnostic" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "workOrderId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "technicianUserId" UUID NOT NULL,
    "status" "PreliminaryDiagnosticStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "mileage" INTEGER,
    "generalNotes" TEXT,
    "operationKey" VARCHAR(120),
    "findingCounter" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreliminaryVehicleDiagnostic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdcFinding" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "pdcId" UUID NOT NULL,
    "category" "PdcFindingCategory" NOT NULL,
    "location" "CheckInDamageLocation",
    "status" "ChecklistObservationStatus" NOT NULL DEFAULT 'ISSUE',
    "severity" "PdcFindingSeverity" NOT NULL,
    "description" TEXT NOT NULL,
    "recommendation" TEXT,
    "requiresImmediateAttention" BOOLEAN NOT NULL DEFAULT false,
    "sequence" INTEGER NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdcFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChecklistTemplate_companyId_type_isActive_idx" ON "ChecklistTemplate"("companyId", "type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_id_version_key" ON "ChecklistTemplate"("id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplate_companyId_type_version_name_key" ON "ChecklistTemplate"("companyId", "type", "version", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplateSection_templateId_order_key" ON "ChecklistTemplateSection"("templateId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistTemplateItem_sectionId_order_key" ON "ChecklistTemplateItem"("sectionId", "order");

-- CreateIndex
CREATE INDEX "ChecklistInstance_companyId_workOrderId_idx" ON "ChecklistInstance"("companyId", "workOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistInstance_id_companyId_key" ON "ChecklistInstance"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistInstance_checkInId_companyId_key" ON "ChecklistInstance"("checkInId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ChecklistItemResult_companyId_instanceId_itemId_key" ON "ChecklistItemResult"("companyId", "instanceId", "itemId");

-- CreateIndex
CREATE INDEX "CheckInDamage_companyId_workOrderId_observedAt_idx" ON "CheckInDamage"("companyId", "workOrderId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CheckInDamage_id_companyId_key" ON "CheckInDamage"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CheckInDamage_companyId_checkInId_operationKey_key" ON "CheckInDamage"("companyId", "checkInId", "operationKey");

-- CreateIndex
CREATE INDEX "PreliminaryVehicleDiagnostic_companyId_workOrderId_status_idx" ON "PreliminaryVehicleDiagnostic"("companyId", "workOrderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PreliminaryVehicleDiagnostic_id_companyId_key" ON "PreliminaryVehicleDiagnostic"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PreliminaryVehicleDiagnostic_companyId_workOrderId_operatio_key" ON "PreliminaryVehicleDiagnostic"("companyId", "workOrderId", "operationKey");

-- CreateIndex
CREATE UNIQUE INDEX "PdcFinding_id_companyId_key" ON "PdcFinding"("id", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "PdcFinding_companyId_pdcId_sequence_key" ON "PdcFinding"("companyId", "pdcId", "sequence");

-- AddForeignKey
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateSection" ADD CONSTRAINT "ChecklistTemplateSection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChecklistTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ChecklistTemplateSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_workOrderId_companyId_fkey" FOREIGN KEY ("workOrderId", "companyId") REFERENCES "WorkOrder"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_checkInId_companyId_fkey" FOREIGN KEY ("checkInId", "companyId") REFERENCES "VehicleCheckIn"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_templateId_templateVersion_fkey" FOREIGN KEY ("templateId", "templateVersion") REFERENCES "ChecklistTemplate"("id", "version") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_createdByUserId_companyId_fkey" FOREIGN KEY ("createdByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemResult" ADD CONSTRAINT "ChecklistItemResult_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemResult" ADD CONSTRAINT "ChecklistItemResult_instanceId_companyId_fkey" FOREIGN KEY ("instanceId", "companyId") REFERENCES "ChecklistInstance"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemResult" ADD CONSTRAINT "ChecklistItemResult_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ChecklistTemplateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChecklistItemResult" ADD CONSTRAINT "ChecklistItemResult_completedByUserId_companyId_fkey" FOREIGN KEY ("completedByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInDamage" ADD CONSTRAINT "CheckInDamage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInDamage" ADD CONSTRAINT "CheckInDamage_workOrderId_companyId_fkey" FOREIGN KEY ("workOrderId", "companyId") REFERENCES "WorkOrder"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInDamage" ADD CONSTRAINT "CheckInDamage_checkInId_companyId_fkey" FOREIGN KEY ("checkInId", "companyId") REFERENCES "VehicleCheckIn"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInDamage" ADD CONSTRAINT "CheckInDamage_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "Vehicle"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInDamage" ADD CONSTRAINT "CheckInDamage_observedByUserId_companyId_fkey" FOREIGN KEY ("observedByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreliminaryVehicleDiagnostic" ADD CONSTRAINT "PreliminaryVehicleDiagnostic_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreliminaryVehicleDiagnostic" ADD CONSTRAINT "PreliminaryVehicleDiagnostic_branchId_companyId_fkey" FOREIGN KEY ("branchId", "companyId") REFERENCES "Branch"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreliminaryVehicleDiagnostic" ADD CONSTRAINT "PreliminaryVehicleDiagnostic_workOrderId_companyId_fkey" FOREIGN KEY ("workOrderId", "companyId") REFERENCES "WorkOrder"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreliminaryVehicleDiagnostic" ADD CONSTRAINT "PreliminaryVehicleDiagnostic_vehicleId_companyId_fkey" FOREIGN KEY ("vehicleId", "companyId") REFERENCES "Vehicle"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreliminaryVehicleDiagnostic" ADD CONSTRAINT "PreliminaryVehicleDiagnostic_technicianUserId_companyId_fkey" FOREIGN KEY ("technicianUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdcFinding" ADD CONSTRAINT "PdcFinding_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdcFinding" ADD CONSTRAINT "PdcFinding_pdcId_companyId_fkey" FOREIGN KEY ("pdcId", "companyId") REFERENCES "PreliminaryVehicleDiagnostic"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdcFinding" ADD CONSTRAINT "PdcFinding_createdByUserId_companyId_fkey" FOREIGN KEY ("createdByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_scope_check" CHECK (("isSystem" = true AND "companyId" IS NULL) OR ("isSystem" = false AND "companyId" IS NOT NULL));
ALTER TABLE "ChecklistTemplate" ADD CONSTRAINT "ChecklistTemplate_version_check" CHECK ("version" > 0);
ALTER TABLE "ChecklistTemplateSection" ADD CONSTRAINT "ChecklistTemplateSection_order_check" CHECK ("order" > 0);
ALTER TABLE "ChecklistTemplateItem" ADD CONSTRAINT "ChecklistTemplateItem_order_check" CHECK ("order" > 0);
ALTER TABLE "ChecklistInstance" ADD CONSTRAINT "ChecklistInstance_dates_check" CHECK (("status" = 'DRAFT' AND "completedAt" IS NULL) OR ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL) OR "status" = 'CANCELLED');
ALTER TABLE "ChecklistItemResult" ADD CONSTRAINT "ChecklistItemResult_value_check" CHECK ("status" IS NOT NULL OR "textValue" IS NOT NULL OR "numericValue" IS NOT NULL OR "selectedValue" IS NOT NULL);
ALTER TABLE "PreliminaryVehicleDiagnostic" ADD CONSTRAINT "PreliminaryVehicleDiagnostic_mileage_check" CHECK ("mileage" IS NULL OR "mileage" >= 0);
ALTER TABLE "PreliminaryVehicleDiagnostic" ADD CONSTRAINT "PreliminaryVehicleDiagnostic_counter_check" CHECK ("findingCounter" >= 0);
ALTER TABLE "PreliminaryVehicleDiagnostic" ADD CONSTRAINT "PreliminaryVehicleDiagnostic_dates_check" CHECK (("status" = 'DRAFT' AND "completedAt" IS NULL) OR ("status" = 'COMPLETED' AND "completedAt" IS NOT NULL) OR "status" = 'CANCELLED');
ALTER TABLE "PdcFinding" ADD CONSTRAINT "PdcFinding_sequence_check" CHECK ("sequence" > 0);
ALTER TABLE "PdcFinding" ADD CONSTRAINT "PdcFinding_description_check" CHECK (length(btrim("description")) > 0);

CREATE UNIQUE INDEX "ChecklistTemplate_system_default_key" ON "ChecklistTemplate"("type") WHERE "isSystem" = true AND "isDefault" = true AND "isActive" = true;
CREATE UNIQUE INDEX "ChecklistTemplate_company_default_key" ON "ChecklistTemplate"("companyId", "type") WHERE "companyId" IS NOT NULL AND "isDefault" = true AND "isActive" = true;
CREATE UNIQUE INDEX "PreliminaryVehicleDiagnostic_one_active_key" ON "PreliminaryVehicleDiagnostic"("companyId", "workOrderId") WHERE "status" <> 'CANCELLED';

INSERT INTO "ChecklistTemplate" ("id", "companyId", "name", "description", "type", "version", "isActive", "isDefault", "isSystem", "updatedAt")
VALUES ('c1000000-0000-4000-8000-000000000001', NULL, 'Check-in padrão — Oficina geral', 'Lista de verificação documental padrão para entrada do veículo.', 'CHECK_IN', 1, true, true, true, now())
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "ChecklistTemplateSection" ("id", "templateId", "title", "order") VALUES
('c1100000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','Identificação',1),
('c1100000-0000-4000-8000-000000000002','c1000000-0000-4000-8000-000000000001','Exterior',2),
('c1100000-0000-4000-8000-000000000003','c1000000-0000-4000-8000-000000000001','Vidros',3),
('c1100000-0000-4000-8000-000000000004','c1000000-0000-4000-8000-000000000001','Rodas e pneus',4),
('c1100000-0000-4000-8000-000000000005','c1000000-0000-4000-8000-000000000001','Interior',5),
('c1100000-0000-4000-8000-000000000006','c1000000-0000-4000-8000-000000000001','Painel',6),
('c1100000-0000-4000-8000-000000000007','c1000000-0000-4000-8000-000000000001','Funcionamento básico',7),
('c1100000-0000-4000-8000-000000000008','c1000000-0000-4000-8000-000000000001','Itens entregues/presentes',8),
('c1100000-0000-4000-8000-000000000009','c1000000-0000-4000-8000-000000000001','Observações gerais',9)
ON CONFLICT ("id") DO NOTHING;

WITH items(section_id, title, item_order, response_type, required, options) AS (VALUES
('c1100000-0000-4000-8000-000000000001'::uuid,'Quilometragem',1,'NUMBER'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000001'::uuid,'Nível de combustível',2,'SELECT'::"ChecklistResponseType",true,'["0","25","50","75","100"]'::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Para-choque dianteiro',1,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Capô',2,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Para-lama dianteiro esquerdo',3,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Para-lama dianteiro direito',4,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Porta dianteira esquerda',5,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Porta dianteira direita',6,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Porta traseira esquerda',7,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Porta traseira direita',8,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Lateral traseira esquerda',9,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Lateral traseira direita',10,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Teto',11,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Porta-malas/tampa traseira',12,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Para-choque traseiro',13,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Retrovisor esquerdo',14,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000002'::uuid,'Retrovisor direito',15,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000003'::uuid,'Para-brisa',1,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000003'::uuid,'Vidro traseiro',2,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000004'::uuid,'Pneu dianteiro esquerdo',1,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000004'::uuid,'Pneu dianteiro direito',2,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000004'::uuid,'Pneu traseiro esquerdo',3,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000004'::uuid,'Pneu traseiro direito',4,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000004'::uuid,'Estepe',5,'STATUS'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000005'::uuid,'Bancos e revestimentos',1,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000005'::uuid,'Objetos pessoais',2,'TEXT'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000006'::uuid,'Luz de injeção',1,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000006'::uuid,'ABS',2,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000006'::uuid,'Airbag',3,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000006'::uuid,'Óleo',4,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000006'::uuid,'Bateria',5,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000006'::uuid,'Temperatura',6,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000006'::uuid,'Freio',7,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000006'::uuid,'TPMS',8,'STATUS'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Motor dá partida',1,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Faróis',2,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Setas',3,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Buzina',4,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Vidros',5,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Travas',6,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Limpador',7,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Ar-condicionado',8,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Multimídia',9,'STATUS'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000007'::uuid,'Freio de estacionamento',10,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Chave principal',1,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Chave reserva',2,'STATUS'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Documento',3,'STATUS'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Manual',4,'STATUS'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Macaco',5,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Chave de roda',6,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Triângulo',7,'STATUS'::"ChecklistResponseType",true,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Tapetes',8,'STATUS'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Calotas',9,'STATUS'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Antena',10,'STATUS'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000008'::uuid,'Objetos pessoais/outros',11,'TEXT'::"ChecklistResponseType",false,NULL::jsonb),
('c1100000-0000-4000-8000-000000000009'::uuid,'Observações gerais',1,'TEXT'::"ChecklistResponseType",false,NULL::jsonb)
)
INSERT INTO "ChecklistTemplateItem" ("id", "sectionId", "title", "responseType", "order", "isRequired", "options")
SELECT gen_random_uuid(), section_id, title, response_type, item_order, required, options FROM items
ON CONFLICT ("sectionId", "order") DO NOTHING;

INSERT INTO "Permission" ("id", "code", "description")
SELECT gen_random_uuid(), p.code, p.description FROM (VALUES
('pdc.view','Consultar PDC'),('pdc.create','Criar PDC'),('pdc.update','Atualizar PDC em rascunho'),('pdc.complete','Concluir PDC')
) AS p(code, description)
WHERE NOT EXISTS (SELECT 1 FROM "Permission" existing WHERE existing.code = p.code);

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id FROM "Role" r JOIN "Permission" p ON p.code IN ('pdc.view','pdc.create','pdc.update','pdc.complete')
WHERE r.code IN ('ADMIN','MANAGER') ON CONFLICT DO NOTHING;
