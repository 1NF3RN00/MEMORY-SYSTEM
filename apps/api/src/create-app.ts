import Fastify, { type FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { EventEmitter, Logger } from "@memory-middleware/observability";
import { loadCompressionEnv } from "./config/compression-env.js";
import { loadDbObservabilityEnv } from "./config/db-observability-env.js";
import type { OperationalStreamHub } from "./lib/operational-stream-hub.js";
import { registerResponseCompression } from "./lib/register-response-compression.js";
import { registerRoutes } from "./routes/index.js";

export interface ApiDependencies {
  logger: Logger;
  prisma: PrismaClient;
  events: EventEmitter;
  operationalStreamHub: OperationalStreamHub;
  traceHeader: string;
}

export async function buildApp(deps: ApiDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  await registerResponseCompression(app, loadCompressionEnv());

  app.addHook("onRequest", async (request, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    reply.header(
      "Access-Control-Allow-Headers",
      "Content-Type, x-trace-id, Authorization, x-api-key",
    );
    if (request.method === "OPTIONS") {
      return reply.status(204).send();
    }
  });

  const { registerRequestLogging, registerRequestTiming, registerRequestDbObservation } =
    await import("@memory-middleware/observability");
  const dbEnv = loadDbObservabilityEnv();

  await registerRequestLogging(app, {
    logger: deps.logger,
    traceHeader: deps.traceHeader,
  });
  await registerRequestTiming(app, {
    logger: deps.logger,
    events: deps.events,
    traceHeader: deps.traceHeader,
  });
  if (dbEnv.DB_OBSERVATION_ENABLED) {
    await registerRequestDbObservation(app, {
      logger: deps.logger,
      events: deps.events,
      slowQueryMs: dbEnv.DB_SLOW_QUERY_MS,
      nPlusOneThreshold: dbEnv.DB_N_PLUS_ONE_THRESHOLD,
      leaderboardCapacity: dbEnv.DB_LEADERBOARD_SIZE,
    });
  }

  app.decorate("prisma", deps.prisma);
  app.decorate("events", deps.events);
  app.decorate("operationalStreamHub", deps.operationalStreamHub);
  app.decorate("appLogger", deps.logger);
  app.decorate("traceHeader", deps.traceHeader);

  const { registerAuthMiddleware } = await import("./middleware/auth.js");
  await registerAuthMiddleware(app);

  await registerRoutes(app, deps.operationalStreamHub);

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    events: EventEmitter;
    operationalStreamHub: OperationalStreamHub;
    appLogger: Logger;
    traceHeader: string;
  }
}
