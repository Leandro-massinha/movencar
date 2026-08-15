import { describe, expect, it } from "vitest";
import {
  checklistPhotoRequirement,
  isChecklistResultIssue,
} from "../src/modules/work-orders/checklist-photo-requirements.js";

describe("regras canônicas de foto da Lista de Verificação", () => {
  it("considera somente ISSUE como problema", () => {
    expect(isChecklistResultIssue("ISSUE")).toBe(true);
    for (const status of ["OK", "NOT_CHECKED", "NOT_APPLICABLE", null] as const)
      expect(isChecklistResultIssue(status)).toBe(false);
  });

  it("aplica requiresPhoto sempre e a regra condicional somente em ISSUE", () => {
    expect(checklistPhotoRequirement({ requiresPhoto: true, photoRequiredOnIssue: true }, "OK")).toBe("REQUIRES_PHOTO");
    expect(checklistPhotoRequirement({ requiresPhoto: false, photoRequiredOnIssue: true }, "ISSUE")).toBe("PHOTO_REQUIRED_ON_ISSUE");
    expect(checklistPhotoRequirement({ requiresPhoto: false, photoRequiredOnIssue: true }, "OK")).toBeNull();
    expect(checklistPhotoRequirement({ requiresPhoto: false, photoRequiredOnIssue: false }, "ISSUE")).toBeNull();
  });
});
