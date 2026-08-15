import { z } from "zod";

export const damageEvidenceFieldsSchema = z.object({
  caption: z.string().trim().max(500).optional(),
}).strict();

export const damageEvidenceParamsSchema = z.object({
  id: z.string().uuid(),
  damageId: z.string().uuid(),
  evidenceId: z.string().uuid().optional(),
});

export type DamageEvidenceFields = z.infer<typeof damageEvidenceFieldsSchema>;
