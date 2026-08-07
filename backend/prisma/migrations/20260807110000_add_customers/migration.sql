-- Customer types and lifecycle states.
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'COMPANY');
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLOCKED');

CREATE TABLE "Customer" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "originBranchId" UUID,
    "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "name" VARCHAR(180) NOT NULL,
    "tradeName" VARCHAR(180),
    "document" VARCHAR(30),
    "stateRegistration" VARCHAR(40),
    "email" VARCHAR(180),
    "phone" VARCHAR(30),
    "whatsapp" VARCHAR(30),
    "birthDate" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerAddress" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "label" VARCHAR(80),
    "postalCode" VARCHAR(20),
    "street" VARCHAR(180) NOT NULL,
    "number" VARCHAR(30),
    "complement" VARCHAR(120),
    "neighborhood" VARCHAR(120),
    "city" VARCHAR(120) NOT NULL,
    "state" VARCHAR(40) NOT NULL,
    "country" VARCHAR(2) NOT NULL DEFAULT 'BR',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Customer_id_companyId_key" ON "Customer"("id", "companyId");
CREATE INDEX "Customer_companyId_name_idx" ON "Customer"("companyId", "name");
CREATE INDEX "Customer_companyId_status_idx" ON "Customer"("companyId", "status");
CREATE INDEX "Customer_companyId_phone_idx" ON "Customer"("companyId", "phone");
CREATE INDEX "Customer_companyId_whatsapp_idx" ON "Customer"("companyId", "whatsapp");
CREATE INDEX "Customer_companyId_deletedAt_idx" ON "Customer"("companyId", "deletedAt");
CREATE INDEX "CustomerAddress_companyId_customerId_idx" ON "CustomerAddress"("companyId", "customerId");
CREATE INDEX "CustomerAddress_companyId_city_state_idx" ON "CustomerAddress"("companyId", "city", "state");

-- Partial indexes preserve legitimate reuse after soft delete and enforce one active primary address.
CREATE UNIQUE INDEX "Customer_company_document_active_key" ON "Customer"("companyId", "document") WHERE "document" IS NOT NULL AND "deletedAt" IS NULL;
CREATE UNIQUE INDEX "CustomerAddress_one_active_primary_key" ON "CustomerAddress"("companyId", "customerId") WHERE "isPrimary" = true AND "deletedAt" IS NULL;

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_originBranchId_fkey" FOREIGN KEY ("originBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Compound tenant key prevents an address from ever referencing a customer in another company.
ALTER TABLE "CustomerAddress" ADD CONSTRAINT "CustomerAddress_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE CASCADE ON UPDATE CASCADE;
