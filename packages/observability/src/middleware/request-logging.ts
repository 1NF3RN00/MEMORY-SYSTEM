import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { Logger } from "../logger.js";
import { createTraceContext } from "../trace.js";

export interface RequestLoggingOptions {
  logger: Logger;
  traceHeader?: string;
}

declare module "fastify" {
  interface FastifyRequest {
    traceId: string;
  }
}

export async function registerRequestLogging(
  app: FastifyInstance,
  options: RequestLoggingOptions,
): Promise<void> {
  const traceHeader = options.traceHeader ?? "x-trace-id";

  app.addHook("onRequest", async (request: FastifyRequest) => {
    const incoming = request.headers[traceHeader];
    const headerValue = Array.isArray(incoming) ? incoming[0] : incoming;
    const traceContext = createTraceContext(headerValue);
    request.traceId = traceContext.traceId;
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    options.logger.info(
      {
        trace_id: request.traceId,
        method: request.method,
        url: request.url,
        status_code: reply.statusCode,
        response_time_ms: reply.elapsedTime,
      },
      "request.completed",
    );
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    options.logger.error(
      {
        trace_id: request.traceId,
        method: request.method,
        url: request.url,
        err: error,
      },
      "request.error",
    );

    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: statusCode >= 500 ? "Internal Server Error" : error.message,
      trace_id: request.traceId,
    });
  });
}
