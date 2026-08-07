import { z } from "zod";

const compact = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .transform((value) => value.replace(/\s+/g, " "));
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value ? value.replace(/\s+/g, " ") : null))
    .nullable()
    .optional();
const plate = z
  .string()
  .trim()
  .max(12)
  .transform((value) => value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
  .refine(
    (value) => !value || /^[A-Z]{3}(?:\d{4}|\d[A-Z]\d{2})$/.test(value),
    "Placa brasileira inválida.",
  )
  .transform((value) => value || null)
  .nullable()
  .optional();
const chassis = z
  .string()
  .trim()
  .max(24)
  .transform((value) => value.toUpperCase().replace(/\s/g, ""))
  .refine(
    (value) => !value || /^[A-HJ-NPR-Z0-9]{17}$/.test(value),
    "Chassi inválido.",
  )
  .transform((value) => value || null)
  .nullable()
  .optional();
const renavam = z
  .string()
  .trim()
  .max(20)
  .transform((value) => value.replace(/\D/g, ""))
  .refine(
    (value) => !value || (value.length >= 9 && value.length <= 11),
    "RENAVAM inválido.",
  )
  .transform((value) => value || null)
  .nullable()
  .optional();
const year = z
  .number()
  .int()
  .min(1886)
  .max(new Date().getFullYear() + 2)
  .nullable()
  .optional();

const fields = {
  customerId: z.string().uuid(),
  originBranchId: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
  plate,
  renavam,
  chassis,
  brand: compact(80),
  model: compact(120),
  version: optionalText(120),
  yearManufacture: year,
  yearModel: year,
  color: optionalText(60),
  fuelType: z
    .enum([
      "GASOLINE",
      "ETHANOL",
      "FLEX",
      "DIESEL",
      "ELECTRIC",
      "HYBRID",
      "GNV",
      "OTHER",
    ])
    .nullable()
    .optional(),
  transmission: z
    .enum(["MANUAL", "AUTOMATIC", "CVT", "AUTOMATED", "OTHER"])
    .nullable()
    .optional(),
  engine: optionalText(80),
  enginePower: z.number().int().min(0).max(5000).nullable().optional(),
  bodyType: optionalText(80),
  doors: z.number().int().min(0).max(10).nullable().optional(),
  currentMileage: z
    .number()
    .int()
    .min(0)
    .max(100_000_000)
    .nullable()
    .optional(),
  notes: optionalText(5000),
};
export const createVehicleSchema = z.object({
  ...fields,
  status: fields.status.default("ACTIVE"),
});
export const updateVehicleSchema = z
  .object(fields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Informe ao menos um campo.",
  );
export const vehicleIdSchema = z.object({ id: z.string().uuid() });
export const listVehicleRecordsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export const listVehiclesSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(180).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
  customerId: z.string().uuid().optional(),
  branchId: z.string().uuid().optional(),
  brand: z.string().trim().max(80).optional(),
  model: z.string().trim().max(120).optional(),
  fuelType: z
    .enum([
      "GASOLINE",
      "ETHANOL",
      "FLEX",
      "DIESEL",
      "ELECTRIC",
      "HYBRID",
      "GNV",
      "OTHER",
    ])
    .optional(),
  sortBy: z
    .enum([
      "plate",
      "brand",
      "model",
      "yearModel",
      "currentMileage",
      "createdAt",
      "updatedAt",
      "status",
    ])
    .default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
export type ListVehiclesInput = z.infer<typeof listVehiclesSchema>;
export type ListVehicleRecordsInput = z.infer<typeof listVehicleRecordsSchema>;
