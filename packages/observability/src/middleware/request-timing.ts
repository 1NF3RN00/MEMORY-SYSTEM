import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "../logger.js";
import type { EventEmitter } from "../events/event-emitter.js";
import { LlmCallCollector } from "../llm/collector.js";
import { emitLlmCallAudit } from "../llm/emit.js";
import { ExecutionTimingCollector } from "../timing/collector.js";
import { runWithTimingAsync } from "../timing/context.js";
import { emitTimingAudit } from "../timing/emit.js";

export interface RequestTimingOptions {
  logger: Logger;
  events?: EventEmitter;
  traceHeader?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    timingCollector: ExecutionTimingCollector;
    llmCallCollector: LlmCallCollector;
  }
}

function handlerStage(request: FastifyRequest): string {
  const route = request.routeOptions?.url ?? request.url;
  return `api_handler:${request.method} ${route}`;
}

export async function registerRequestTiming(
  app: FastifyInstance,
  options: RequestTimingOptions,
): Promise<void> {
  app.addHook("onRequest", async (request: FastifyRequest) => {
    const collector = new ExecutionTimingCollector(request.traceId);
    request.timingCollector = collector;
    request.llmCallCollector = new LlmCallCollector(request.traceId);
    collector.startStage("query_received");
  });

  app.addHook("preHandler", async (request: FastifyRequest) => {
    request.timingCollector.startStage(handlerStage(request));
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const collector = request.timingCollector;
    collector.endStage(handlerStage(request));
    collector.endStage("query_received");
    collector.startStage("response");
    collector.endStage("response");

    const audit = collector.toAudit();
    reply.header("X-Timing-Total-Ms", String(audit.totalLatency));

    await emitTimingAudit(options.logger, options.events, audit, {
      method: request.method,
      route: request.routeOptions?.url ?? request.url,
      status_code: reply.statusCode,
    });

    const llmAudit = request.llmCallCollector.toAudit();
    await emitLlmCallAudit(options.logger, options.events, llmAudit, {
      method: request.method,
      route: request.routeOptions?.url ?? request.url,
      status_code: reply.statusCode,
    });
  });
}

export function withRequestTiming<T>(
  request: FastifyRequest,
  fn: () => Promise<T>,
): Promise<T> {
  return runWithTimingAsync(request.timingCollector, fn, request.llmCallCollector);
}
