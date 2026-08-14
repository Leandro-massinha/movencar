import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

export const workOrderIdSchema = z.object({ id: z.string().uuid() });
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(8)
  .max(120)
  .regex(/^[A-Za-z0-9._:-]+$/)
  .optional();
export const listWorkOrdersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(["OPEN", "CANCELLED", "CLOSED_NO_SERVICE", "CLOSED"])
    .optional(),
  vehicleId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});
export const createWorkOrderSchema = z.object({
  branchId: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  purpose: z.enum([
    "DIAGNOSTIC",
    "EVALUATION",
    "MAINTENANCE",
    "REPAIR",
    "INSPECTION",
    "REVISION",
    "WARRANTY",
    "COURTESY",
    "RETURN",
    "OTHER",
  ]),
  mileageAtEntry: z.number().int().min(0).max(100_000_000).optional(),
  notes: optionalText(5000),
});
export const closeWorkOrderSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("COMPLETED"),
    closingNotes: optionalText(5000),
  }),
  z.object({
    outcome: z.literal("NO_SERVICE"),
    closingReason: z.enum([
      "PRICE",
      "POSTPONED",
      "NO_AUTHORIZATION",
      "PART_UNAVAILABLE",
      "CUSTOMER_WITHDREW",
      "VEHICLE_REMOVED",
      "SECOND_OPINION",
      "OTHER",
    ]),
    closingNotes: optionalText(5000),
  }),
  z.object({
    outcome: z.literal("CANCELLED"),
    closingNotes: optionalText(5000),
  }),
]);
export const createConcernSchema = z.object({
  description: z.string().trim().min(1).max(5000),
  category: optionalText(80),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  symptomStartedAt: z.coerce.date().optional(),
  frequency: optionalText(120),
  condition: optionalText(240),
  notes: optionalText(5000),
});
export const createCheckInSchema = z.object({
  mileage: z.number().int().min(0).max(100_000_000).optional(),
  fuelLevel: z.number().int().min(0).max(100).optional(),
  deliveredBy: optionalText(180),
  generalNotes: optionalText(5000),
});
export const updateCheckInSchema = createCheckInSchema.refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo.",
);
export const checklistResultParamsSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
});
export const checklistResultSchema = z
  .object({
    status: z.enum(["OK", "ISSUE", "NOT_CHECKED", "NOT_APPLICABLE"]).optional(),
    textValue: optionalText(5000),
    numericValue: z.number().finite().min(0).max(100_000_000).optional(),
    selectedValue: optionalText(240),
    note: optionalText(5000),
  })
  .refine(
    (value) =>
      value.status !== undefined ||
      value.textValue != null ||
      value.numericValue !== undefined ||
      value.selectedValue != null,
    "Informe uma resposta.",
  );
export const createDamageSchema = z.object({
  location: z.enum([
    "FRONT_BUMPER",
    "REAR_BUMPER",
    "HOOD",
    "ROOF",
    "TRUNK_LID",
    "FRONT_LEFT_FENDER",
    "FRONT_RIGHT_FENDER",
    "REAR_LEFT_QUARTER",
    "REAR_RIGHT_QUARTER",
    "FRONT_LEFT_DOOR",
    "FRONT_RIGHT_DOOR",
    "REAR_LEFT_DOOR",
    "REAR_RIGHT_DOOR",
    "LEFT_MIRROR",
    "RIGHT_MIRROR",
    "WINDSHIELD",
    "REAR_GLASS",
    "LEFT_FRONT_GLASS",
    "RIGHT_FRONT_GLASS",
    "LEFT_REAR_GLASS",
    "RIGHT_REAR_GLASS",
    "FRONT_LEFT_HEADLIGHT",
    "FRONT_RIGHT_HEADLIGHT",
    "REAR_LEFT_TAILLIGHT",
    "REAR_RIGHT_TAILLIGHT",
    "FRONT_LEFT_WHEEL",
    "FRONT_RIGHT_WHEEL",
    "REAR_LEFT_WHEEL",
    "REAR_RIGHT_WHEEL",
    "INTERIOR",
    "DASHBOARD",
    "TRUNK",
    "OTHER",
  ]),
  damageType: z.enum([
    "SCRATCH",
    "SCUFF",
    "DENT",
    "CRACK",
    "BROKEN",
    "MISSING",
    "WORN",
    "STAIN",
    "CHIPPED",
    "DAMAGED",
    "OTHER",
  ]),
  severity: z.enum(["MINOR", "MODERATE", "SEVERE"]),
  description: optionalText(5000),
});
export const createPdcSchema = z.object({
  mileage: z.number().int().min(0).max(100_000_000).optional(),
  generalNotes: optionalText(5000),
});
export const updatePdcSchema = createPdcSchema.refine(
  (value) => Object.keys(value).length > 0,
  "Informe ao menos um campo.",
);
export const findingParamsSchema = z.object({
  id: z.string().uuid(),
  findingId: z.string().uuid(),
});
export const pdcFindingSchema = z.object({
  category: z.enum([
    "BRAKES",
    "SUSPENSION",
    "STEERING",
    "ENGINE",
    "TRANSMISSION",
    "ELECTRICAL",
    "BATTERY",
    "TIRES",
    "AIR_CONDITIONING",
    "FLUIDS",
    "BODY",
    "INTERIOR",
    "SAFETY",
    "OTHER",
  ]),
  location: createDamageSchema.shape.location.optional(),
  status: z
    .enum(["OK", "ISSUE", "NOT_CHECKED", "NOT_APPLICABLE"])
    .default("ISSUE"),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().trim().min(1).max(5000),
  recommendation: optionalText(5000),
  requiresImmediateAttention: z.boolean().default(false),
});

export type ListWorkOrdersInput = z.infer<typeof listWorkOrdersSchema>;
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type CloseWorkOrderInput = z.infer<typeof closeWorkOrderSchema>;
export type CreateConcernInput = z.infer<typeof createConcernSchema>;
export type CreateCheckInInput = z.infer<typeof createCheckInSchema>;
export type ChecklistResultInput = z.infer<typeof checklistResultSchema>;
export type CreateDamageInput = z.infer<typeof createDamageSchema>;
export type CreatePdcInput = z.infer<typeof createPdcSchema>;
export type PdcFindingInput = z.infer<typeof pdcFindingSchema>;
