import { z } from "zod";
export const loginSchema = z.object({
  companyCode: z.string().trim().min(2).max(60),
  email: z
    .string()
    .trim()
    .email()
    .transform((v) => v.toLowerCase()),
  password: z.string().min(8).max(128),
});
export const passwordSchema = z
  .string()
  .min(10)
  .max(128)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^A-Za-z0-9]/);
