import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260814120000_add_private_file_assets/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);

describe("persistência Core de arquivos privados", () => {
  it("declara os enums e modelos tipados no schema", () => {
    for (const definition of [
      "enum FileStorageProvider",
      "enum FileAssetStatus",
      "enum FileAssetOwnershipType",
      "enum CheckInEvidenceCategory",
      "model FileAsset",
      "model CheckInEvidenceAttachment",
      "model CheckInDamageEvidenceAttachment",
    ]) {
      expect(schema).toContain(definition);
    }
    for (const category of [
      "FRONT",
      "REAR",
      "LEFT_SIDE",
      "RIGHT_SIDE",
      "DASHBOARD",
      "ODOMETER",
      "FUEL",
      "INTERIOR_FRONT",
      "INTERIOR_REAR",
      "TRUNK",
      "ENGINE_BAY",
      "OTHER",
    ]) {
      expect(schema).toContain(category);
    }
  });

  it("cria as três tabelas de forma incremental e compatível com banco vazio", () => {
    for (const table of [
      "FileAsset",
      "CheckInEvidenceAttachment",
      "CheckInDamageEvidenceAttachment",
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    expect(migration).not.toMatch(/DROP\s+(TABLE|COLUMN|TYPE)/u);
    expect(migration).not.toMatch(/(?:UPDATE|DELETE FROM|TRUNCATE)\s+"/u);
  });

  it("mantém storageKey única e SHA somente indexado, sem deduplicação", () => {
    expect(migration).toContain("FileAsset_storageKey_key");
    expect(migration).toContain("FileAsset_companyId_sha256_idx");
    expect(migration).not.toContain("FileAsset_sha256_key");
  });

  it("torna companyId obrigatório nas três entidades", () => {
    expect(
      migration.match(/"companyId" UUID NOT NULL/gu),
    ).toHaveLength(3);
  });

  it("protege todas as relações de tenant com FKs compostas", () => {
    for (const constraint of [
      "FileAsset_uploadedByUserId_companyId_fkey",
      "CheckInEvidenceAttachment_checkInId_companyId_fkey",
      "CIEA_file_company_owner_fkey",
      "CheckInEvidenceAttachment_createdByUserId_companyId_fkey",
      "CheckInDamageEvidenceAttachment_checkInId_companyId_fkey",
      "CIDEA_damage_checkin_company_fkey",
      "CIDEA_file_company_owner_fkey",
      "CheckInDamageEvidenceAttachment_createdByUserId_companyId_fkey",
    ]) {
      expect(migration).toContain(constraint);
    }
    expect(migration).toContain("CheckInDamage_id_checkInId_companyId_key");
  });

  it("impede ownership cruzado e conserva ownership após soft delete", () => {
    expect(migration).toContain(
      'CHECK ("fileOwnershipType" = \'CHECK_IN\')',
    );
    expect(migration).toContain(
      'CHECK ("fileOwnershipType" = \'CHECK_IN_DAMAGE\')',
    );
    expect(migration).toContain(
      "CheckInEvidenceAttachment_fileAssetId_key",
    );
    expect(migration).toContain(
      "CheckInDamageEvidenceAttachment_fileAssetId_key",
    );
    expect(schema).toContain("ownershipType      FileAssetOwnershipType?");
  });

  it("adiciona checks de integridade, soft delete e índices operacionais", () => {
    for (const constraint of [
      "FileAsset_size_check",
      "FileAsset_sha256_check",
      "FileAsset_extension_check",
      "FileAsset_detected_mime_check",
      "FileAsset_status_dates_check",
      "CheckInEvidenceAttachment_sequence_check",
      "CheckInDamageEvidenceAttachment_sequence_check",
    ]) {
      expect(migration).toContain(constraint);
    }
    expect(migration).toContain("CheckInEvidenceAttachment_active_sequence_key");
    expect(migration).toContain(
      "CheckInDamageEvidenceAttachment_active_sequence_key",
    );
    expect(schema.match(/deletedAt\s+DateTime\?/gu)?.length).toBeGreaterThan(5);
  });

  it("usa somente RESTRICT nas novas FKs e não cria permissões", () => {
    expect(migration).not.toContain("ON DELETE CASCADE");
    expect(migration).not.toContain("ON DELETE SET NULL");
    expect(migration).not.toContain("files.view");
    expect(migration).not.toContain("files.manage");
  });
});
