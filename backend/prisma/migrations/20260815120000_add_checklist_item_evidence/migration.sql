ALTER TYPE "FileAssetOwnershipType" RENAME TO "FileAssetOwnershipType_old";
CREATE TYPE "FileAssetOwnershipType" AS ENUM ('CHECK_IN', 'CHECK_IN_DAMAGE', 'CHECKLIST_ITEM');

ALTER TABLE "CheckInEvidenceAttachment" DROP CONSTRAINT "CIEA_file_company_owner_fkey";
ALTER TABLE "CheckInDamageEvidenceAttachment" DROP CONSTRAINT "CIDEA_file_company_owner_fkey";
ALTER TABLE "CheckInEvidenceAttachment" DROP CONSTRAINT "CheckInEvidenceAttachment_ownership_type_check";
ALTER TABLE "CheckInDamageEvidenceAttachment" DROP CONSTRAINT "CheckInDamageEvidenceAttachment_ownership_type_check";
ALTER TABLE "CheckInEvidenceAttachment" ALTER COLUMN "fileOwnershipType" DROP DEFAULT;
ALTER TABLE "CheckInDamageEvidenceAttachment" ALTER COLUMN "fileOwnershipType" DROP DEFAULT;
ALTER TABLE "FileAsset" ALTER COLUMN "ownershipType" TYPE "FileAssetOwnershipType"
USING "ownershipType"::text::"FileAssetOwnershipType";
ALTER TABLE "CheckInEvidenceAttachment" ALTER COLUMN "fileOwnershipType" TYPE "FileAssetOwnershipType"
USING "fileOwnershipType"::text::"FileAssetOwnershipType";
ALTER TABLE "CheckInDamageEvidenceAttachment" ALTER COLUMN "fileOwnershipType" TYPE "FileAssetOwnershipType"
USING "fileOwnershipType"::text::"FileAssetOwnershipType";
ALTER TABLE "CheckInEvidenceAttachment" ALTER COLUMN "fileOwnershipType" SET DEFAULT 'CHECK_IN';
ALTER TABLE "CheckInDamageEvidenceAttachment" ALTER COLUMN "fileOwnershipType" SET DEFAULT 'CHECK_IN_DAMAGE';
ALTER TABLE "CheckInEvidenceAttachment" ADD CONSTRAINT "CheckInEvidenceAttachment_ownership_type_check" CHECK ("fileOwnershipType" = 'CHECK_IN');
ALTER TABLE "CheckInDamageEvidenceAttachment" ADD CONSTRAINT "CheckInDamageEvidenceAttachment_ownership_type_check" CHECK ("fileOwnershipType" = 'CHECK_IN_DAMAGE');
ALTER TABLE "CheckInEvidenceAttachment" ADD CONSTRAINT "CIEA_file_company_owner_fkey" FOREIGN KEY ("fileAssetId", "companyId", "fileOwnershipType") REFERENCES "FileAsset"("id", "companyId", "ownershipType") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CheckInDamageEvidenceAttachment" ADD CONSTRAINT "CIDEA_file_company_owner_fkey" FOREIGN KEY ("fileAssetId", "companyId", "fileOwnershipType") REFERENCES "FileAsset"("id", "companyId", "ownershipType") ON DELETE RESTRICT ON UPDATE CASCADE;
DROP TYPE "FileAssetOwnershipType_old";

CREATE UNIQUE INDEX "ChecklistItemResult_id_instanceId_itemId_companyId_key"
ON "ChecklistItemResult"("id", "instanceId", "itemId", "companyId");

CREATE TABLE "ChecklistItemEvidenceAttachment" (
  "id" UUID NOT NULL,
  "companyId" UUID NOT NULL,
  "checkInId" UUID NOT NULL,
  "checklistInstanceId" UUID NOT NULL,
  "checklistItemId" UUID NOT NULL,
  "itemResultId" UUID NOT NULL,
  "fileAssetId" UUID NOT NULL,
  "fileOwnershipType" "FileAssetOwnershipType" NOT NULL DEFAULT 'CHECKLIST_ITEM',
  "caption" VARCHAR(500),
  "sequence" INTEGER NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChecklistItemEvidenceAttachment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChecklistItemEvidenceAttachment_ownership_type_check" CHECK ("fileOwnershipType" = 'CHECKLIST_ITEM'),
  CONSTRAINT "ChecklistItemEvidenceAttachment_sequence_check" CHECK ("sequence" > 0)
);

CREATE UNIQUE INDEX "ChecklistItemEvidenceAttachment_fileAssetId_key" ON "ChecklistItemEvidenceAttachment"("fileAssetId");
CREATE UNIQUE INDEX "ChecklistItemEvidenceAttachment_id_companyId_key" ON "ChecklistItemEvidenceAttachment"("id", "companyId");
CREATE INDEX "CIIEA_company_checkin_instance_result_sequence_idx" ON "ChecklistItemEvidenceAttachment"("companyId", "checkInId", "checklistInstanceId", "itemResultId", "sequence");
CREATE INDEX "ChecklistItemEvidenceAttachment_companyId_deletedAt_idx" ON "ChecklistItemEvidenceAttachment"("companyId", "deletedAt");
CREATE UNIQUE INDEX "ChecklistItemEvidenceAttachment_active_sequence_key" ON "ChecklistItemEvidenceAttachment"("companyId", "itemResultId", "sequence") WHERE "deletedAt" IS NULL;

ALTER TABLE "ChecklistItemEvidenceAttachment" ADD CONSTRAINT "ChecklistItemEvidenceAttachment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChecklistItemEvidenceAttachment" ADD CONSTRAINT "ChecklistItemEvidenceAttachment_checkInId_companyId_fkey" FOREIGN KEY ("checkInId", "companyId") REFERENCES "VehicleCheckIn"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChecklistItemEvidenceAttachment" ADD CONSTRAINT "ChecklistItemEvidenceAttachment_checklistInstanceId_compan_fkey" FOREIGN KEY ("checklistInstanceId", "companyId") REFERENCES "ChecklistInstance"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChecklistItemEvidenceAttachment" ADD CONSTRAINT "CIIEA_result_instance_item_company_fkey" FOREIGN KEY ("itemResultId", "checklistInstanceId", "checklistItemId", "companyId") REFERENCES "ChecklistItemResult"("id", "instanceId", "itemId", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChecklistItemEvidenceAttachment" ADD CONSTRAINT "CIIEA_file_company_owner_fkey" FOREIGN KEY ("fileAssetId", "companyId", "fileOwnershipType") REFERENCES "FileAsset"("id", "companyId", "ownershipType") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChecklistItemEvidenceAttachment" ADD CONSTRAINT "ChecklistItemEvidenceAttachment_createdByUserId_companyId_fkey" FOREIGN KEY ("createdByUserId", "companyId") REFERENCES "User"("id", "companyId") ON DELETE RESTRICT ON UPDATE CASCADE;
