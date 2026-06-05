import "./load-env.js";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  API_HOST: z.string().default("0.0.0.0"),
  API_PORT: z.coerce
    .number()
    .int()
    .positive()
    .optional()
    .default(Number(process.env.PORT ?? 3000)),
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),
  TRACE_HEADER: z.string().default("x-trace-id"),
  OPENAI_API_KEY: z.string().optional(),
  WORKFLOW_ANALYSIS_MODEL: z.string().optional(),
  WORKFLOW_ANALYSIS_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  PAGESPEED_API_KEY: z.string().optional(),
  APIFY_API_TOKEN: z.string().optional(),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(2000),
  TEMPORARY_MEMORY_TTL_MS: z.coerce.number().int().positive().default(3600000),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_JWT_SECRET: z.string().min(1).optional(),
  PASSWORD_SETUP_REDIRECT_URL: z.string().url().optional(),
  PLATFORM_ADMIN_EMAILS: z.string().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment configuration: ${JSON.stringify(details)}`);
  }

  return parsed.data;
}
