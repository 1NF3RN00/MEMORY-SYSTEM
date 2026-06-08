import type { FastifyInstance } from "fastify";
import type { AppEnv } from "./config/env.js";
import { loadEnv } from "./config/env.js";
import { buildApp } from "./create-app.js";
import { maybeAutoBootstrapPlatformAdmin } from "./lib/auto-bootstrap-platform.js";
import { connectDatabase } from "./lib/database.js";
import { createPrismaEventSink } from "./lib/event-sink.js";
import { createOperationalStreamHub, type OperationalStreamHub } from "./lib/operational-stream-hub.js";
import {
  createSubscribableEventEmitter,
  type SubscribableEventEmitter,
} from "./lib/subscribable-event-emitter.js";
import { createLogger, type Logger } from "@memory-middleware/observability";
import { bootstrapBuiltInProviders } from "@memory-middleware/observation-providers";
import { bootstrapDefaultRegistry } from "@memory-middleware/observation-registry";
import type { PrismaClient } from "@prisma/client";

export interface ApiRuntime {
  env: AppEnv;
  logger: Logger;
  prisma: PrismaClient;
  events: SubscribableEventEmitter;
  operationalStreamHub: OperationalStreamHub;
  app: FastifyInstance;
}

export async function createApiRuntime(): Promise<ApiRuntime> {
  const env = loadEnv();
  const logger = createLogger({
    level: env.LOG_LEVEL,
    service: "api",
    baseContext: { environment: env.NODE_ENV },
  });

  const prisma = await connectDatabase(logger);
  bootstrapDefaultRegistry();
  const providerConfig: {
    pagespeedApiKey?: string;
    apifyApiToken?: string;
  } = {};
  if (env.PAGESPEED_API_KEY) providerConfig.pagespeedApiKey = env.PAGESPEED_API_KEY;
  if (env.APIFY_API_TOKEN) providerConfig.apifyApiToken = env.APIFY_API_TOKEN;
  bootstrapBuiltInProviders(providerConfig);
  const events = createSubscribableEventEmitter({
    logger,
    sink: createPrismaEventSink(prisma),
  });
  const operationalStreamHub = createOperationalStreamHub(events);

  try {
    await maybeAutoBootstrapPlatformAdmin(prisma, events, logger);
  } catch (error) {
    logger.warn(
      {
        err: error,
        hint: "Verify Supabase connection pooling is enabled and DATABASE_URL uses the pooler host",
      },
      "platform.auto_bootstrap_skipped",
    );
  }

  const app = await buildApp({
    logger,
    prisma,
    events,
    operationalStreamHub,
    traceHeader: env.TRACE_HEADER,
  });

  return { env, logger, prisma, events, operationalStreamHub, app };
}

export function resolveListenPort(env: AppEnv): number {
  return env.API_PORT ?? Number(process.env.PORT ?? 3000);
}
