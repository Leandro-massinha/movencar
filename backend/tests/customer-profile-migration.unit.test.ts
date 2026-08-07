import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sql = readFileSync(new URL("../prisma/migrations/20260810120000_add_customer_360_profile/migration.sql", import.meta.url), "utf8");

describe("Customer 360 migration", () => {
  it("enforces primary contacts, addresses and profile uniqueness", () => {
    expect(sql).toContain("CustomerContact_one_primary_active_type_key");
    expect(sql).toContain("CustomerAddress_one_primary_active_key");
    expect(sql).toContain("CustomerIdentityProfile_customerId_companyId_key");
    expect(sql).toContain("CustomerFiscalProfile_customerId_companyId_key");
  });
  it("uses compound tenant-safe foreign keys without destructive cascade", () => {
    expect(sql).toContain('FOREIGN KEY ("targetCustomerId", "companyId")');
    expect(sql).toContain('FOREIGN KEY ("fiscalAddressId", "companyId", "customerId")');
    expect(sql).not.toContain("ON DELETE CASCADE");
  });
  it("protects verification, consent, relationship and self-reference invariants", () => {
    for (const constraint of ["CustomerContact_verification_check", "CustomerConsent_dates_check", "CustomerRelationship_not_self_check", "CustomerRelationship_period_check"])
      expect(sql).toContain(constraint);
  });
  it("backfills legacy contacts and fiscal registration without dropping legacy columns", () => {
    for (const type of ["'EMAIL'", "'PHONE'", "'WHATSAPP'"]) expect(sql).toContain(type);
    expect(sql).toContain('INSERT INTO "CustomerFiscalProfile"');
    expect(sql).not.toMatch(/DROP COLUMN\s+"(?:email|phone|whatsapp|stateRegistration)"/);
  });
});
