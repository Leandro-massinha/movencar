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

export type ListWorkOrdersInput = z.infer<typeof listWorkOrdersSchema>;
export type CreateWorkOrderInput = z.infer<typeof createWorkOrderSchema>;
export type CloseWorkOrderInput = z.infer<typeof closeWorkOrderSchema>;
export type CreateConcernInput = z.infer<typeof createConcernSchema>;
export type CreateCheckInInput = z.infer<typeof createCheckInSchema>;
