-- CreateEnum
CREATE TYPE "FileStorageProvider" AS ENUM ('LOCAL_PRIVATE');

-- CreateEnum
CREATE TYPE "FileAssetStatus" AS ENUM ('PENDING', 'AVAILABLE', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "FileAssetOwnershipType" AS ENUM ('CHECK_IN', 'CHECK_IN_DAMAGE');

-- CreateEnum
CREATE TYPE "CheckInEvidenceCategory" AS ENUM ('FRONT', 'REAR', 'LEFT_SIDE', 'RIGHT_SIDE', 'DASHBOARD', 'ODOMETER', 'FUEL', 'INTERIOR_FRONT', 'INTERIOR_REAR', 'TRUNK', 'ENGINE_BAY', 'OTHER');

-- The parent key is needed by the damage attachment's tenant + check-in FK.
CREATE UNIQUE INDEX "CheckInDamage_id_checkInId_companyId_key"
ON "CheckInDamage"("id", "checkInId", "companyId");

-- CreateTable
CREATE TABLE "FileAsset" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "storageProvider" "FileStorageProvider" NOT NULL DEFAULT 'LOCAL_PRIVATE',
    "storageKey" VARCHAR(500) NOT NULL,
    "originalFilename" VARCHAR(255) NOT NULL,
    "declaredMimeType" VARCHAR(120) NOT NULL,
    "detectedMimeType" VARCHAR(120) NOT NULL,
    "canonicalExtension" VARCHAR(16) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "sha256" VARCHAR(64) NOT NULL,
    "status" "FileAssetStatus" NOT NULL DEFAULT 'PENDING',
    "ownershipType" "FileAssetOwnershipType",
    "uploadedByUserId" UUID NOT NULL,
    "availableAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileAsset_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "FileAsset_size_check" CHECK ("sizeBytes" > 0),
    CONSTRAINT "FileAsset_sha256_check" CHECK ("sha256" ~ '^[0-9a-fA-F]{64}$'),
    CONSTRAINT "FileAsset_extension_check" CHECK (length(btrim("canonicalExtension")) > 0),
    CONSTRAINT "FileAsset_detected_mime_check" CHECK (length(btrim("detectedMimeType")) > 0),
    CONSTRAINT "FileAsset_status_dates_check" CHECK (
        ("status" IN ('PENDING', 'FAILED') AND "availableAt" IS NULL AND "deletedAt" IS NULL)
        OR ("status" = 'AVAILABLE' AND "availableAt" IS NOT NULL AND "deletedAt" IS NULL)
        OR ("status" = 'DELETED' AND "deletedAt" IS NOT NULL)
    )
);

-- CreateTable
CREATE TABLE "CheckInEvidenceAttachment" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "checkInId" UUID NOT NULL,
    "fileAssetId" UUID NOT NULL,
    "fileOwnershipType" "FileAssetOwnershipType" NOT NULL DEFAULT 'CHECK_IN',
    "category" "CheckInEvidenceCategory" NOT NULL,
    "caption" VARCHAR(500),
    "sequence" INTEGER NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckInEvidenceAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CheckInEvidenceAttachment_ownership_type_check" CHECK ("fileOwnershipType" = 'CHECK_IN'),
    CONSTRAINT "CheckInEvidenceAttachment_sequence_check" CHECK ("sequence" > 0)
);

-- CreateTable
CREATE TABLE "CheckInDamageEvidenceAttachment" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "checkInId" UUID NOT NULL,
    "damageId" UUID NOT NULL,
    "fileAssetId" UUID NOT NULL,
    "fileOwnershipType" "FileAssetOwnershipType" NOT NULL DEFAULT 'CHECK_IN_DAMAGE',
    "caption" VARCHAR(500),
    "sequence" INTEGER NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInDamageEvidenceAttachment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CheckInDamageEvidenceAttachment_ownership_type_check" CHECK ("fileOwnershipType" = 'CHECK_IN_DAMAGE'),
    CONSTRAINT "CheckInDamageEvidenceAttachment_sequence_check" CHECK ("sequence" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "FileAsset_storageKey_key" ON "FileAsset"("storageKey");
CREATE UNIQUE INDEX "FileAsset_id_companyId_key" ON "FileAsset"("id", "companyId");
CREATE UNIQUE INDEX "FileAsset_id_companyId_ownershipType_key" ON "FileAsset"("id", "companyId", "ownershipType");
CREATE INDEX "FileAsset_companyId_status_createdAt_idx" ON "FileAsset"("companyId", "status", "createdAt");
CREATE INDEX "FileAsset_companyId_sha256_idx" ON "FileAsset"("companyId", "sha256");
CREATE INDEX "FileAsset_companyId_deletedAt_idx" ON "FileAsset"("companyId", "deletedAt");

CREATE UNIQUE INDEX "CheckInEvidenceAttachment_fileAssetId_key" ON "CheckInEvidenceAttachment"("fileAssetId");
CREATE UNIQUE INDEX "CheckInEvidenceAttachment_id_companyId_key" ON "CheckInEvidenceAttachment"("id", "companyId");
CREATE INDEX "CIEA_company_checkin_category_sequence_idx" ON "CheckInEvidenceAttachment"("companyId", "checkInId", "category", "sequence");
CREATE INDEX "CheckInEvidenceAttachment_companyId_deletedAt_idx" ON "CheckInEvidenceAttachment"("companyId", "deletedAt");
CREATE UNIQUE INDEX "CheckInEvidenceAttachment_active_sequence_key"
ON "CheckInEvidenceAttachment"("companyId", "checkInId", "category", "sequence")
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "CheckInDamageEvidenceAttachment_fileAssetId_key" ON "CheckInDamageEvidenceAttachment"("fileAssetId");
CREATE UNIQUE INDEX "CheckInDamageEvidenceAttachment_id_companyId_key" ON "CheckInDamageEvidenceAttachment"("id", "companyId");
CREATE INDEX "CIDEA_company_checkin_damage_sequence_idx" ON "CheckInDamageEvidenceAttachment"("companyId", "checkInId", "damageId", "sequence");
CREATE INDEX "CheckInDamageEvidenceAttachment_companyId_deletedAt_idx" ON "CheckInDamageEvidenceAttachment"("companyId", "deletedAt");
CREATE UNIQUE INDEX "CheckInDamageEvidenceAttachment_active_sequence_key"
ON "CheckInDamageEvidenceAttachment"("companyId", "damageId", "sequence")
WHERE "deletedAt" IS NULL;

-- AddForeignKey: all tenant-bound relations are compound and destructive cascades are forbidden.
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FileAsset" ADD CONSTRAINT "FileAsset_uploadedByUserId_companyId_fkey" FOREIGN KEY ("uploadedByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CheckInEvidenceAttachment" ADD CONSTRAINT "CheckInEvidenceAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckInEvidenceAttachment" ADD CONSTRAINT "CheckInEvidenceAttachment_checkInId_companyId_fkey" FOREIGN KEY ("checkInId", "companyId") REFERENCES "VehicleCheckIn"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckInEvidenceAttachment" ADD CONSTRAINT "CIEA_file_company_owner_fkey" FOREIGN KEY ("fileAssetId", "companyId", "fileOwnershipType") REFERENCES "FileAsset"("id", "companyId", "ownershipType") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckInEvidenceAttachment" ADD CONSTRAINT "CheckInEvidenceAttachment_createdByUserId_companyId_fkey" FOREIGN KEY ("createdByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CheckInDamageEvidenceAttachment" ADD CONSTRAINT "CheckInDamageEvidenceAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckInDamageEvidenceAttachment" ADD CONSTRAINT "CheckInDamageEvidenceAttachment_checkInId_companyId_fkey" FOREIGN KEY ("checkInId", "companyId") REFERENCES "VehicleCheckIn"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckInDamageEvidenceAttachment" ADD CONSTRAINT "CIDEA_damage_checkin_company_fkey" FOREIGN KEY ("damageId", "checkInId", "companyId") REFERENCES "CheckInDamage"("id", "checkInId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckInDamageEvidenceAttachment" ADD CONSTRAINT "CIDEA_file_company_owner_fkey" FOREIGN KEY ("fileAssetId", "companyId", "fileOwnershipType") REFERENCES "FileAsset"("id", "companyId", "ownershipType") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckInDamageEvidenceAttachment" ADD CONSTRAINT "CheckInDamageEvidenceAttachment_createdByUserId_companyId_fkey" FOREIGN KEY ("createdByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
