import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../prisma/migrations/20260815120000_add_checklist_item_evidence/migration.sql", import.meta.url),
  "utf8",
);

describe("migration de evidências de item", () => {
  it("adiciona ownership e FKs compostas sem operação destrutiva", () => {
    expect(migration).toContain("'CHECKLIST_ITEM'");
    expect(migration).toContain('USING "ownershipType"::text::"FileAssetOwnershipType"');
    expect(migration).toContain("CIIEA_result_instance_item_company_fkey");
    expect(migration).toContain("CIIEA_file_company_owner_fkey");
    expect(migration).toContain("WHERE \"deletedAt\" IS NULL");
    expect(migration).not.toMatch(/DROP TABLE|DROP COLUMN|TRUNCATE/i);
  });
});
