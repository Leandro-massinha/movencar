import type { ChecklistObservationStatus } from "@prisma/client";

export const isChecklistResultIssue = (
  status: ChecklistObservationStatus | null | undefined,
) => status === "ISSUE";

export type ChecklistPhotoRequirementReason =
  | "REQUIRES_PHOTO"
  | "PHOTO_REQUIRED_ON_ISSUE";

export function checklistPhotoRequirement(
  item: { requiresPhoto: boolean; photoRequiredOnIssue: boolean },
  status: ChecklistObservationStatus | null | undefined,
): ChecklistPhotoRequirementReason | null {
  if (item.requiresPhoto) return "REQUIRES_PHOTO";
  if (item.photoRequiredOnIssue && isChecklistResultIssue(status))
    return "PHOTO_REQUIRED_ON_ISSUE";
  return null;
}
