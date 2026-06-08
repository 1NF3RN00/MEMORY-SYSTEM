import type { Logger } from "@memory-middleware/observability";
import {
  createInstrumentedPrismaClient,
  type InstrumentedPrismaClient,
} from "@memory-middleware/observability";
import { loadDbObservabilityEnv } from "../config/db-observability-env.js";

let prisma: InstrumentedPrismaClient | undefined;

export function getPrismaClient(logger?: Logger): InstrumentedPrismaClient {
  if (!prisma) {
    const dbEnv = loadDbObservabilityEnv();
    prisma = createInstrumentedPrismaClient({
      enabled: dbEnv.DB_OBSERVATION_ENABLED,
      slowQueryMs: dbEnv.DB_SLOW_QUERY_MS,
      nPlusOneThreshold: dbEnv.DB_N_PLUS_ONE_THRESHOLD,
      explainOnSlow: dbEnv.DB_EXPLAIN_ON_SLOW,
      explainAnalyze: dbEnv.DB_EXPLAIN_ANALYZE,
      ...(logger ? { logger } : {}),
    });
  }

  return prisma;
}

export async function connectDatabase(logger: Logger): Promise<InstrumentedPrismaClient> {
  const client = getPrismaClient(logger);
  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    logger.info({ component: "database" }, "database.deferred_connect");
    return client;
  }

  try {
    await client.$connect();
    logger.info({ component: "database" }, "database.connected");
    return client;
  } catch (error) {
    logger.error(
      {
        component: "database",
        err: error,
        hint: "Start PostgreSQL with: npm run docker:up (requires Docker Desktop running)",
      },
      "database.connection_failed",
    );
    throw error;
  }
}

export async function disconnectDatabase(logger: Logger): Promise<void> {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = undefined;
  logger.info({ component: "database" }, "database.disconnected");
}
