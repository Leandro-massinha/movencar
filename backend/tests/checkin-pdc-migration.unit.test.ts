import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260812120000_add_checkin_damage_pdc/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const schema = readFileSync(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);

describe("Check-in, damage map and PDC migration", () => {
  it("creates normalized versioned checklist tables instead of a JSON aggregate", () => {
    for (const table of [
      "ChecklistTemplate",
      "ChecklistTemplateSection",
      "ChecklistTemplateItem",
      "ChecklistInstance",
      "ChecklistItemResult",
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    expect(schema).toContain("templateVersion");
    expect(migration).toContain(
      "ChecklistInstance_templateId_templateVersion_fkey",
    );
  });

  it("keeps global templates immutable in scope and defaults unique", () => {
    expect(migration).toContain("ChecklistTemplate_scope_check");
    expect(migration).toContain("ChecklistTemplate_system_default_key");
    expect(migration).toContain('ON CONFLICT ("id") DO NOTHING');
  });

  it("protects tenant relationships with compound foreign keys", () => {
    for (const constraint of [
      "ChecklistInstance_workOrderId_companyId_fkey",
      "CheckInDamage_checkInId_companyId_fkey",
      "PreliminaryVehicleDiagnostic_workOrderId_companyId_fkey",
      "PdcFinding_pdcId_companyId_fkey",
    ])
      expect(migration).toContain(constraint);
  });

  it("enforces one active PDC and coherent completion dates", () => {
    expect(migration).toContain("PreliminaryVehicleDiagnostic_one_active_key");
    expect(migration).toContain("PreliminaryVehicleDiagnostic_dates_check");
    expect(migration).toContain("ChecklistInstance_dates_check");
  });

  it("seeds the pt-BR workshop template and PDC permissions", () => {
    expect(migration).toContain("Check-in padrão — Oficina geral");
    expect(migration).toContain("Para-choque dianteiro");
    expect(migration).toContain("Luz de injeção");
    for (const permission of [
      "pdc.view",
      "pdc.create",
      "pdc.update",
      "pdc.complete",
    ])
      expect(migration).toContain(permission);
  });
});
