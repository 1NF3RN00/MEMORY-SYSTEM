import { z } from "zod";

const dbObservabilitySchema = z.object({
  DB_SLOW_QUERY_MS: z.coerce.number().int().positive().default(100),
  DB_OBSERVATION_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value !== "false"),
  DB_EXPLAIN_ON_SLOW: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  DB_EXPLAIN_ANALYZE: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  DB_N_PLUS_ONE_THRESHOLD: z.coerce.number().int().min(2).default(3),
  DB_LEADERBOARD_SIZE: z.coerce.number().int().positive().default(500),
  DB_LEADERBOARD_HISTORY_WINDOW: z.coerce.number().int().positive().default(1000),
});

export type DbObservabilityEnv = z.infer<typeof dbObservabilitySchema>;

export function loadDbObservabilityEnv(): DbObservabilityEnv {
  const parsed = dbObservabilitySchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid DB observability configuration: ${JSON.stringify(details)}`);
  }
  return parsed.data;
}
