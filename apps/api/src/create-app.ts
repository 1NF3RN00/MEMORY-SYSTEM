import Fastify, { type FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { EventEmitter, Logger } from "@memory-middleware/observability";
import { registerRoutes } from "./routes/index.js";

export interface ApiDependencies {
  logger: Logger;
  prisma: PrismaClient;
  events: EventEmitter;
  traceHeader: string;
}

export async function buildApp(deps: ApiDependencies): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

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

  const { registerRequestLogging } = await import("@memory-middleware/observability");
  await registerRequestLogging(app, {
    logger: deps.logger,
    traceHeader: deps.traceHeader,
  });

  app.decorate("prisma", deps.prisma);
  app.decorate("events", deps.events);
  app.decorate("appLogger", deps.logger);
  app.decorate("traceHeader", deps.traceHeader);

  const { registerAuthMiddleware } = await import("./middleware/auth.js");
  await registerAuthMiddleware(app);

  await registerRoutes(app);

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
    events: EventEmitter;
    appLogger: Logger;
    traceHeader: string;
  }
}
