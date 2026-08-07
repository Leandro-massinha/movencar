CREATE TYPE "ModuleStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "CompanyModuleStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'EXPIRED');

CREATE TABLE "Module" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "status" "ModuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "isCore" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Module_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompanyModule" (
    "companyId" UUID NOT NULL,
    "moduleId" UUID NOT NULL,
    "status" "CompanyModuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "activatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "configuration" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyModule_pkey" PRIMARY KEY ("companyId", "moduleId")
);

CREATE UNIQUE INDEX "Module_code_key" ON "Module"("code");
CREATE INDEX "CompanyModule_companyId_status_idx" ON "CompanyModule"("companyId", "status");
CREATE INDEX "CompanyModule_moduleId_status_idx" ON "CompanyModule"("moduleId", "status");

ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
