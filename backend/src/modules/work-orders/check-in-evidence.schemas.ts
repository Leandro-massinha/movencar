import { z } from "zod";

export const checkInEvidenceCategorySchema = z.enum([
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
]);

export const checkInEvidenceFieldsSchema = z
  .object({
    category: checkInEvidenceCategorySchema,
    caption: z
      .string()
      .trim()
      .max(500)
      .transform((value) => value || null)
      .optional(),
  })
  .strict();

export const checkInEvidenceParamsSchema = z.object({
  id: z.string().uuid(),
  evidenceId: z.string().uuid(),
});

export type CheckInEvidenceFields = z.infer<
  typeof checkInEvidenceFieldsSchema
>;
