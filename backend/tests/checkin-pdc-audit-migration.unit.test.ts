import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260812130000_freeze_checklist_history/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Check-in/PDC pre-deploy hardening migration", () => {
  it("freezes referenced template content and structure", () => {
    expect(migration).toContain("ChecklistTemplate_history_guard");
    expect(migration).toContain("ChecklistTemplateSection_history_guard");
    expect(migration).toContain("ChecklistTemplateItem_history_guard");
    expect(migration).toContain("referenced checklist structure is immutable");
  });

  it("guards result ownership, type coherence and completed instances", () => {
    expect(migration).toContain("ChecklistItemResult_value_guard");
    expect(migration).toContain("checklist item does not belong to instance template");
    expect(migration).toContain("completed checklist results are immutable");
    expect(migration).toContain("checklist result does not match response type");
  });
});
