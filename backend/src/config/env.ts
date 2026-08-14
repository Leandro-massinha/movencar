import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3334),
  DATABASE_URL: z.string().min(1),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  COOKIE_SECURE: z.enum(["true", "false"]).default("false"),
  LOG_LEVEL: z.string().default("info"),
  PRIVATE_STORAGE_PROVIDER: z.literal("local-private").default("local-private"),
  PRIVATE_STORAGE_ROOT: z.string().trim().optional(),
  PHOTO_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.PRIVATE_STORAGE_ROOT) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["PRIVATE_STORAGE_ROOT"],
      message: "PRIVATE_STORAGE_ROOT é obrigatório em produção.",
    });
  }
});

export const env = schema.parse(process.env);
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const privateStorageRoot = path.resolve(
  env.PRIVATE_STORAGE_ROOT ?? path.join(backendRoot, ".private-storage"),
);
export const corsOrigins = env.CORS_ORIGINS.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
