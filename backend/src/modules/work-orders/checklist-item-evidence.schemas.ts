import { z } from "zod";

export const checklistItemEvidenceFieldsSchema = z.object({
  caption: z.string().trim().max(500).optional(),
}).strict();

export const checklistItemEvidenceParamsSchema = z.object({
  id: z.string().uuid(),
  itemResultId: z.string().uuid(),
  evidenceId: z.string().uuid().optional(),
});

export type ChecklistItemEvidenceFields = z.infer<typeof checklistItemEvidenceFieldsSchema>;
