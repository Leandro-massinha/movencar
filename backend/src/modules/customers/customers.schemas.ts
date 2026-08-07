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
const optionalDigits = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value ? value.replace(/\D/g, "") : null))
    .nullable()
    .optional();
const document = optionalDigits(30);
const phone = optionalDigits(30).refine(
  (value) => value == null || (value.length >= 8 && value.length <= 15),
  "Telefone inválido.",
);
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email()
  .max(180)
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));
const birthDate = z
  .string()
  .date()
  .transform((value) => new Date(`${value}T00:00:00.000Z`))
  .nullable()
  .optional();

function validCpf(value: string) {
  if (!/^\d{11}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = (length: number) => {
    const sum = value
      .slice(0, length)
      .split("")
      .reduce((total, number, index) => total + Number(number) * (length + 1 - index), 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return digit(9) === Number(value[9]) && digit(10) === Number(value[10]);
}

function validCnpj(value: string) {
  if (!/^\d{14}$/.test(value) || /^(\d)\1+$/.test(value)) return false;
  const digit = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = value.slice(0, length).split("").reduce((total, number, index) => total + Number(number) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}

const customerFields = {
  originBranchId: z.string().uuid().nullable().optional(),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]),
  name: compact(180),
  tradeName: optionalText(180),
  document,
  stateRegistration: optionalText(40),
  email,
  phone,
  whatsapp: phone,
  birthDate,
  notes: optionalText(5000),
};

function validateDocument(
  input: { type?: "INDIVIDUAL" | "COMPANY"; document?: string | null },
  context: z.RefinementCtx,
) {
  const allowed =
    input.type === "COMPANY"
      ? [14]
      : input.type === "INDIVIDUAL"
        ? [11]
        : [11, 14];
  if (input.document && !allowed.includes(input.document.length)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["document"],
      message:
        input.type === "COMPANY"
          ? "CNPJ deve ter 14 digitos."
          : input.type === "INDIVIDUAL"
            ? "CPF deve ter 11 digitos."
            : "Documento deve ter 11 ou 14 digitos.",
    });
  } else if (
    input.document &&
    !(
      (input.document.length === 11 && validCpf(input.document)) ||
      (input.document.length === 14 && validCnpj(input.document))
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["document"],
      message: input.document.length === 14 ? "CNPJ inválido." : "CPF inválido.",
    });
  }
}

export const createCustomerSchema = z
  .object({
    ...customerFields,
    type: customerFields.type.default("INDIVIDUAL"),
    status: customerFields.status.default("ACTIVE"),
  })
  .superRefine(validateDocument);
export const updateCustomerSchema = z
  .object(customerFields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Informe ao menos um campo.",
  )
  .superRefine(validateDocument);
export const customerIdSchema = z.object({ id: z.string().uuid() });
export const customerAddressIdSchema = z.object({
  id: z.string().uuid(),
  addressId: z.string().uuid(),
});
export const listCustomersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(180).optional(),
  status: z.enum(["ACTIVE", "INACTIVE", "BLOCKED"]).optional(),
  type: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
  branchId: z.string().uuid().optional(),
  sortBy: z.enum(["name", "createdAt", "updatedAt", "status"]).default("name"),
  sortOrder: z.enum(["asc", "desc"]).default("asc"),
});

const addressFields = {
  label: optionalText(80),
  type: z.enum(["HOME", "COMMERCIAL", "FISCAL", "BILLING", "DELIVERY", "OTHER"]).optional(),
  postalCode: optionalDigits(20),
  street: compact(180),
  number: optionalText(30),
  complement: optionalText(120),
  neighborhood: optionalText(120),
  city: compact(120),
  state: compact(40),
  country: z
    .string()
    .trim()
    .length(2)
    .transform((value) => value.toUpperCase())
    .optional(),
  reference: optionalText(180),
  ibgeCode: z.string().trim().regex(/^\d{7}$/).nullable().optional(),
  isPrimary: z.boolean().optional(),
};
export const createAddressSchema = z.object(addressFields);
export const updateAddressSchema = z
  .object(addressFields)
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "Informe ao menos um campo.",
  );

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type ListCustomersInput = z.infer<typeof listCustomersSchema>;
export type CreateAddressInput = z.infer<typeof createAddressSchema>;
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>;
