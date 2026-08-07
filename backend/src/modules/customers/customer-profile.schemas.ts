import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();
const date = z.string().date().transform((value) => new Date(`${value}T00:00:00.000Z`)).nullable().optional();
const optionalFields = <T extends z.ZodRawShape>(shape: T) => z.object(shape).refine((value) => Object.keys(value).length > 0, "Informe ao menos um campo.");

export const identityProfileSchema = optionalFields({
  rgNumber: text(40), rgIssuer: text(40),
  rgIssuerState: z.string().trim().length(2).transform((value) => value.toUpperCase()).nullable().optional(),
  rgIssuedAt: date, socialName: text(180), nationality: text(80),
});

export const contactSchema = z.object({
  type: z.enum(["PHONE", "WHATSAPP", "EMAIL"]), label: text(80), value: z.string().trim().min(1).max(180),
  purpose: z.enum(["PERSONAL", "COMMERCIAL", "FINANCIAL", "ADMINISTRATIVE", "FLEET", "EMERGENCY", "OTHER"]).default("PERSONAL"),
  isPrimary: z.boolean().default(false),
  isVerified: z.boolean().default(false),
  verificationSource: z.enum(["MANUAL", "EMAIL_LINK", "WHATSAPP", "SMS", "CUSTOMER_PORTAL", "INTEGRATION"]).optional(),
}).superRefine((value, context) => {
  const normalized = value.type === "EMAIL" ? value.value.toLowerCase() : value.value.replace(/\D/g, "");
  if (value.type === "EMAIL" && !z.string().email().safeParse(normalized).success)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "E-mail inválido." });
  if (value.type !== "EMAIL" && (normalized.length < 8 || normalized.length > 15))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["value"], message: "Telefone inválido." });
  if (value.isVerified && !value.verificationSource)
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["verificationSource"], message: "Informe a origem da verificação." });
});

export const contactIdSchema = z.object({ id: z.string().uuid(), contactId: z.string().uuid() });
export const fiscalProfileSchema = optionalFields({
  taxpayerIndicator: z.enum(["TAXPAYER", "EXEMPT", "NON_TAXPAYER", "UNKNOWN"]).optional(),
  stateRegistration: text(40), municipalRegistration: text(40), fiscalAddressId: z.string().uuid().nullable().optional(), notes: text(2000),
});
export const relationshipSchema = z.object({
  targetCustomerId: z.string().uuid(),
  type: z.enum(["SPOUSE", "FAMILY_MEMBER", "EMPLOYEE", "DRIVER", "FLEET_MANAGER", "FINANCIAL_RESPONSIBLE", "AUTHORIZED_CONTACT", "LEGAL_REPRESENTATIVE", "OTHER"]),
  validFrom: z.coerce.date().optional(), validUntil: z.coerce.date().nullable().optional(), notes: text(2000),
}).refine((value) => !value.validUntil || !value.validFrom || value.validUntil >= value.validFrom, { path: ["validUntil"], message: "Fim da vigência deve ser posterior ao início." });
export const communicationPreferenceSchema = optionalFields({
  preferredChannel: z.enum(["PHONE", "WHATSAPP", "EMAIL", "NONE"]).optional(),
  acceptsOperationalCalls: z.boolean().optional(), acceptsOperationalWhatsapp: z.boolean().optional(), acceptsOperationalEmail: z.boolean().optional(),
  preferredTime: text(120), notes: text(2000),
});
export const consentSchema = z.object({
  type: z.enum(["PRIVACY_POLICY", "MARKETING_WHATSAPP", "MARKETING_EMAIL", "MARKETING_SMS", "DATA_PROCESSING", "CUSTOMER_PORTAL_TERMS", "OTHER"]),
  version: z.string().trim().min(1).max(40), status: z.enum(["GRANTED", "REVOKED"]),
  source: z.enum(["IN_PERSON", "REMOTE_LINK", "CUSTOMER_PORTAL", "WHATSAPP_LINK", "EMAIL_LINK", "IMPORT", "OTHER"]),
  occurredAt: z.coerce.date(), notes: text(1000),
});
export const customerProfileIdempotencyKeySchema = z.string().trim().min(8).max(120).regex(/^[A-Za-z0-9._:-]+$/).optional();
export const duplicateQuerySchema = z.object({
  document: z.string().trim().transform((value) => value.replace(/\D/g, "")).optional(),
  phone: z.string().trim().transform((value) => value.replace(/\D/g, "")).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
}).refine((value) => Boolean(value.document || value.phone || value.email), "Informe documento, telefone ou e-mail.");

export type IdentityProfileInput = z.infer<typeof identityProfileSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type FiscalProfileInput = z.infer<typeof fiscalProfileSchema>;
export type RelationshipInput = z.infer<typeof relationshipSchema>;
export type CommunicationPreferenceInput = z.infer<typeof communicationPreferenceSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
export type DuplicateQuery = z.infer<typeof duplicateQuerySchema>;
