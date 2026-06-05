import type { FastifyInstance } from "fastify";
import type { AppEnv } from "./config/env.js";
import { loadEnv } from "./config/env.js";
import { buildApp } from "./create-app.js";
import { maybeAutoBootstrapPlatformAdmin } from "./lib/auto-bootstrap-platform.js";
import { connectDatabase } from "./lib/database.js";
import { createPrismaEventSink } from "./lib/event-sink.js";
import {
  createLogger,
  createLoggingEventEmitter,
  type EventEmitter,
  type Logger,
} from "@memory-middleware/observability";
import { bootstrapBuiltInProviders } from "@memory-middleware/observation-providers";
import { bootstrapDefaultRegistry } from "@memory-middleware/observation-registry";
import type { PrismaClient } from "@prisma/client";

export interface ApiRuntime {
  env: AppEnv;
  logger: Logger;
  prisma: PrismaClient;
  events: EventEmitter;
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
  const events = createLoggingEventEmitter({
    logger,
    sink: createPrismaEventSink(prisma),
  });

  await maybeAutoBootstrapPlatformAdmin(prisma, events, logger);

  const app = await buildApp({
    logger,
    prisma,
    events,
    traceHeader: env.TRACE_HEADER,
  });

  return { env, logger, prisma, events, app };
}

export function resolveListenPort(env: AppEnv): number {
  return env.API_PORT ?? Number(process.env.PORT ?? 3000);
}
