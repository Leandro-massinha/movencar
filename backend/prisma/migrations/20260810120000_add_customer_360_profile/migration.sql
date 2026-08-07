CREATE TYPE "CustomerAddressType" AS ENUM ('HOME', 'COMMERCIAL', 'FISCAL', 'BILLING', 'DELIVERY', 'OTHER');
CREATE TYPE "CustomerContactType" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL');
CREATE TYPE "CustomerContactPurpose" AS ENUM ('PERSONAL', 'COMMERCIAL', 'FINANCIAL', 'ADMINISTRATIVE', 'FLEET', 'EMERGENCY', 'OTHER');
CREATE TYPE "ContactVerificationSource" AS ENUM ('MANUAL', 'EMAIL_LINK', 'WHATSAPP', 'SMS', 'CUSTOMER_PORTAL', 'INTEGRATION');
CREATE TYPE "TaxpayerIndicator" AS ENUM ('TAXPAYER', 'EXEMPT', 'NON_TAXPAYER', 'UNKNOWN');
CREATE TYPE "CustomerRelationshipType" AS ENUM ('SPOUSE', 'FAMILY_MEMBER', 'EMPLOYEE', 'DRIVER', 'FLEET_MANAGER', 'FINANCIAL_RESPONSIBLE', 'AUTHORIZED_CONTACT', 'LEGAL_REPRESENTATIVE', 'OTHER');
CREATE TYPE "CustomerPreferredChannel" AS ENUM ('PHONE', 'WHATSAPP', 'EMAIL', 'NONE');
CREATE TYPE "CustomerConsentType" AS ENUM ('PRIVACY_POLICY', 'MARKETING_WHATSAPP', 'MARKETING_EMAIL', 'MARKETING_SMS', 'DATA_PROCESSING', 'CUSTOMER_PORTAL_TERMS', 'OTHER');
CREATE TYPE "CustomerConsentStatus" AS ENUM ('GRANTED', 'REVOKED');
CREATE TYPE "CustomerConsentSource" AS ENUM ('IN_PERSON', 'REMOTE_LINK', 'CUSTOMER_PORTAL', 'WHATSAPP_LINK', 'EMAIL_LINK', 'IMPORT', 'OTHER');

ALTER TABLE "CustomerAddress"
  ADD COLUMN "type" "CustomerAddressType" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "reference" VARCHAR(180),
  ADD COLUMN "ibgeCode" VARCHAR(7);

CREATE UNIQUE INDEX "CustomerAddress_id_companyId_key" ON "CustomerAddress"("id", "companyId");
CREATE UNIQUE INDEX "CustomerAddress_id_companyId_customerId_key" ON "CustomerAddress"("id", "companyId", "customerId");
CREATE UNIQUE INDEX "CustomerAddress_one_primary_active_key" ON "CustomerAddress"("companyId", "customerId") WHERE "isPrimary" = true AND "deletedAt" IS NULL;

CREATE TABLE "CustomerIdentityProfile" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "rgNumber" VARCHAR(40),
  "rgIssuer" VARCHAR(40),
  "rgIssuerState" VARCHAR(2),
  "rgIssuedAt" DATE,
  "socialName" VARCHAR(180),
  "nationality" VARCHAR(80),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerIdentityProfile_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerIdentityProfile_rg_state_check" CHECK ("rgIssuerState" IS NULL OR "rgIssuerState" ~ '^[A-Z]{2}$')
);

CREATE TABLE "CustomerContact" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "type" "CustomerContactType" NOT NULL,
  "label" VARCHAR(80),
  "value" VARCHAR(180) NOT NULL,
  "normalizedValue" VARCHAR(180) NOT NULL,
  "purpose" "CustomerContactPurpose" NOT NULL DEFAULT 'PERSONAL',
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "isVerified" BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt" TIMESTAMP(3),
  "verificationSource" "ContactVerificationSource",
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerContact_value_check" CHECK (length(btrim("value")) > 0 AND length(btrim("normalizedValue")) > 0),
  CONSTRAINT "CustomerContact_verification_check" CHECK (("isVerified" = true AND "verifiedAt" IS NOT NULL AND "verificationSource" IS NOT NULL) OR ("isVerified" = false AND "verifiedAt" IS NULL AND "verificationSource" IS NULL)),
  CONSTRAINT "CustomerContact_primary_active_check" CHECK ("isPrimary" = false OR "isActive" = true)
);

CREATE TABLE "CustomerFiscalProfile" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "taxpayerIndicator" "TaxpayerIndicator" NOT NULL DEFAULT 'UNKNOWN',
  "stateRegistration" VARCHAR(40),
  "municipalRegistration" VARCHAR(40),
  "fiscalAddressId" UUID,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerFiscalProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerRelationship" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "sourceCustomerId" UUID NOT NULL,
  "targetCustomerId" UUID NOT NULL,
  "type" "CustomerRelationshipType" NOT NULL,
  "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerRelationship_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerRelationship_not_self_check" CHECK ("sourceCustomerId" <> "targetCustomerId"),
  CONSTRAINT "CustomerRelationship_period_check" CHECK ("validUntil" IS NULL OR "validUntil" >= "validFrom")
);

CREATE TABLE "CustomerCommunicationPreference" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "preferredChannel" "CustomerPreferredChannel" NOT NULL DEFAULT 'NONE',
  "acceptsOperationalCalls" BOOLEAN NOT NULL DEFAULT true,
  "acceptsOperationalWhatsapp" BOOLEAN NOT NULL DEFAULT true,
  "acceptsOperationalEmail" BOOLEAN NOT NULL DEFAULT true,
  "preferredTime" VARCHAR(120),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerCommunicationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerConsent" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "customerId" UUID NOT NULL,
  "type" "CustomerConsentType" NOT NULL,
  "version" VARCHAR(40) NOT NULL,
  "status" "CustomerConsentStatus" NOT NULL,
  "grantedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "source" "CustomerConsentSource" NOT NULL,
  "recordedByUserId" UUID NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerConsent_dates_check" CHECK (("status" = 'GRANTED' AND "grantedAt" IS NOT NULL AND "revokedAt" IS NULL) OR ("status" = 'REVOKED' AND "revokedAt" IS NOT NULL))
);

CREATE UNIQUE INDEX "CustomerIdentityProfile_id_companyId_key" ON "CustomerIdentityProfile"("id", "companyId");
CREATE UNIQUE INDEX "CustomerIdentityProfile_customerId_companyId_key" ON "CustomerIdentityProfile"("customerId", "companyId");
CREATE INDEX "CustomerIdentityProfile_companyId_customerId_idx" ON "CustomerIdentityProfile"("companyId", "customerId");
CREATE UNIQUE INDEX "CustomerContact_id_companyId_key" ON "CustomerContact"("id", "companyId");
CREATE INDEX "CustomerContact_companyId_customerId_type_isActive_idx" ON "CustomerContact"("companyId", "customerId", "type", "isActive");
CREATE INDEX "CustomerContact_companyId_normalizedValue_isActive_idx" ON "CustomerContact"("companyId", "normalizedValue", "isActive");
CREATE UNIQUE INDEX "CustomerContact_one_primary_active_type_key" ON "CustomerContact"("companyId", "customerId", "type") WHERE "isPrimary" = true AND "isActive" = true;
CREATE UNIQUE INDEX "CustomerContact_active_value_key" ON "CustomerContact"("companyId", "customerId", "type", "normalizedValue") WHERE "isActive" = true;
CREATE UNIQUE INDEX "CustomerFiscalProfile_id_companyId_key" ON "CustomerFiscalProfile"("id", "companyId");
CREATE UNIQUE INDEX "CustomerFiscalProfile_customerId_companyId_key" ON "CustomerFiscalProfile"("customerId", "companyId");
CREATE INDEX "CustomerFiscalProfile_companyId_customerId_idx" ON "CustomerFiscalProfile"("companyId", "customerId");
CREATE INDEX "CustomerFiscalProfile_companyId_fiscalAddressId_idx" ON "CustomerFiscalProfile"("companyId", "fiscalAddressId");
CREATE UNIQUE INDEX "CustomerRelationship_id_companyId_key" ON "CustomerRelationship"("id", "companyId");
CREATE INDEX "CustomerRelationship_companyId_sourceCustomerId_validFrom_idx" ON "CustomerRelationship"("companyId", "sourceCustomerId", "validFrom");
CREATE INDEX "CustomerRelationship_companyId_targetCustomerId_validFrom_idx" ON "CustomerRelationship"("companyId", "targetCustomerId", "validFrom");
CREATE UNIQUE INDEX "CustomerRelationship_active_key" ON "CustomerRelationship"("companyId", "sourceCustomerId", "targetCustomerId", "type") WHERE "validUntil" IS NULL;
CREATE UNIQUE INDEX "CustomerCommunicationPreference_id_companyId_key" ON "CustomerCommunicationPreference"("id", "companyId");
CREATE UNIQUE INDEX "CustomerCommunicationPreference_customerId_companyId_key" ON "CustomerCommunicationPreference"("customerId", "companyId");
CREATE INDEX "CustomerCommunicationPreference_companyId_customerId_idx" ON "CustomerCommunicationPreference"("companyId", "customerId");
CREATE UNIQUE INDEX "CustomerConsent_id_companyId_key" ON "CustomerConsent"("id", "companyId");
CREATE INDEX "CustomerConsent_companyId_customerId_type_createdAt_idx" ON "CustomerConsent"("companyId", "customerId", "type", "createdAt");
CREATE INDEX "CustomerConsent_companyId_status_createdAt_idx" ON "CustomerConsent"("companyId", "status", "createdAt");

ALTER TABLE "CustomerIdentityProfile" ADD CONSTRAINT "CustomerIdentityProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerIdentityProfile" ADD CONSTRAINT "CustomerIdentityProfile_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerFiscalProfile" ADD CONSTRAINT "CustomerFiscalProfile_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerFiscalProfile" ADD CONSTRAINT "CustomerFiscalProfile_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerFiscalProfile" ADD CONSTRAINT "CustomerFiscalProfile_fiscalAddressId_companyId_customerId_fkey" FOREIGN KEY ("fiscalAddressId", "companyId", "customerId") REFERENCES "CustomerAddress"("id", "companyId", "customerId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerRelationship" ADD CONSTRAINT "CustomerRelationship_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerRelationship" ADD CONSTRAINT "CustomerRelationship_sourceCustomerId_companyId_fkey" FOREIGN KEY ("sourceCustomerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerRelationship" ADD CONSTRAINT "CustomerRelationship_targetCustomerId_companyId_fkey" FOREIGN KEY ("targetCustomerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerCommunicationPreference" ADD CONSTRAINT "CustomerCommunicationPreference_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerCommunicationPreference" ADD CONSTRAINT "CustomerCommunicationPreference_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerConsent" ADD CONSTRAINT "CustomerConsent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerConsent" ADD CONSTRAINT "CustomerConsent_customerId_companyId_fkey" FOREIGN KEY ("customerId", "companyId") REFERENCES "Customer"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerConsent" ADD CONSTRAINT "CustomerConsent_recordedByUserId_companyId_fkey" FOREIGN KEY ("recordedByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "CustomerContact" ("id", "companyId", "customerId", "type", "value", "normalizedValue", "purpose", "isPrimary", "isVerified", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "companyId", "id", 'EMAIL', btrim("email"), lower(btrim("email")), 'PERSONAL', true, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Customer" WHERE "deletedAt" IS NULL AND nullif(btrim("email"), '') IS NOT NULL;
INSERT INTO "CustomerContact" ("id", "companyId", "customerId", "type", "value", "normalizedValue", "purpose", "isPrimary", "isVerified", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "companyId", "id", 'PHONE', "phone", regexp_replace("phone", '\D', '', 'g'), 'PERSONAL', true, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Customer" WHERE "deletedAt" IS NULL AND nullif(regexp_replace("phone", '\D', '', 'g'), '') IS NOT NULL;
INSERT INTO "CustomerContact" ("id", "companyId", "customerId", "type", "value", "normalizedValue", "purpose", "isPrimary", "isVerified", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "companyId", "id", 'WHATSAPP', "whatsapp", regexp_replace("whatsapp", '\D', '', 'g'), 'PERSONAL', true, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Customer" WHERE "deletedAt" IS NULL AND nullif(regexp_replace("whatsapp", '\D', '', 'g'), '') IS NOT NULL;

INSERT INTO "CustomerFiscalProfile" ("id", "companyId", "customerId", "stateRegistration", "taxpayerIndicator", "createdAt", "updatedAt")
SELECT gen_random_uuid(), "companyId", "id", "stateRegistration", 'UNKNOWN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Customer" WHERE "deletedAt" IS NULL AND nullif(btrim("stateRegistration"), '') IS NOT NULL;
