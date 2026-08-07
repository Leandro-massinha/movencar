import { z } from "zod";
const compact = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((value) => value.replace(/\s+/g, " "));
const description = z
  .string()
  .trim()
  .max(5000)
  .transform((value) => value || null)
  .nullable()
  .optional();
const eventDate = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value))
  .optional();
export const createHistoryEventSchema = z
  .object({
    branchId: z.string().uuid().nullable().optional(),
    eventType: z
      .enum(["NOTE", "MILEAGE_RECORDED", "OWNER_CHANGED", "GENERAL"])
      .default("NOTE"),
    title: compact(180),
    description,
    mileage: z.number().int().min(0).max(100_000_000).nullable().optional(),
    eventDate,
  })
  .superRefine((value, ctx) => {
    if (value.eventType === "MILEAGE_RECORDED" && value.mileage == null)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mileage"],
        message: "Quilometragem obrigatória para este evento.",
      });
  });
export const historyParamsSchema = z.object({ vehicleId: z.string().uuid() });
export const historyEventParamsSchema = z.object({
  vehicleId: z.string().uuid(),
  eventId: z.string().uuid(),
});
export const listHistorySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    eventType: z
      .enum([
        "VEHICLE_CREATED",
        "VEHICLE_UPDATED",
        "MILEAGE_RECORDED",
        "NOTE",
        "OWNER_CHANGED",
        "GENERAL",
        "WORK_ORDER_OPENED",
        "CUSTOMER_CONCERN_RECORDED",
        "CHECK_IN_COMPLETED",
        "WORK_ORDER_CLOSED_NO_SERVICE",
        "WORK_ORDER_COMPLETED",
        "WORK_ORDER_CANCELLED",
      ])
      .optional(),
    dateFrom: z
      .string()
      .date()
      .transform((value) => new Date(`${value}T00:00:00.000Z`))
      .optional(),
    dateTo: z
      .string()
      .date()
      .transform((value) => new Date(`${value}T23:59:59.999Z`))
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .refine(
    (value) =>
      !value.dateFrom || !value.dateTo || value.dateFrom <= value.dateTo,
    { path: ["dateTo"], message: "Período inválido." },
  );
export type CreateHistoryEventInput = z.infer<typeof createHistoryEventSchema>;
export type ListHistoryInput = z.infer<typeof listHistorySchema>;
