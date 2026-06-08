import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { DbQueryAggregator } from "../database/aggregator.js";
import { emitDbScopeCompleted } from "../database/emit.js";
import { activateDbObservationScope, getDbQueryAggregator } from "../database/scope.js";
import type { Logger } from "../logger.js";
import type { EventEmitter } from "../events/event-emitter.js";

export interface RequestDbObservationOptions {
  logger: Logger;
  events?: EventEmitter;
  slowQueryMs?: number;
  nPlusOneThreshold?: number;
  leaderboardCapacity?: number;
}

declare module "fastify" {
  interface FastifyRequest {
    dbQueryAggregator?: DbQueryAggregator;
  }
}

export async function registerRequestDbObservation(
  app: FastifyInstance,
  options: RequestDbObservationOptions,
): Promise<void> {
  app.addHook("onRequest", (request: FastifyRequest, _reply, done) => {
    const aggregatorOptions = {
      ...(options.slowQueryMs !== undefined ? { slowQueryMs: options.slowQueryMs } : {}),
      ...(options.nPlusOneThreshold !== undefined
        ? { nPlusOneThreshold: options.nPlusOneThreshold }
        : {}),
    };

    activateDbObservationScope(
      { scopeId: request.traceId, scopeType: "request" },
      aggregatorOptions,
      () => {
        const aggregator = getDbQueryAggregator();
        if (aggregator) {
          request.dbQueryAggregator = aggregator;
        }
        done();
      },
    );
  });

  app.addHook("onResponse", async (request: FastifyRequest, reply: FastifyReply) => {
    const aggregator = request.dbQueryAggregator ?? getDbQueryAggregator();
    if (!aggregator) {
      return;
    }

    const summary = aggregator.toSummary();
    await emitDbScopeCompleted(options.logger, options.events, summary, {
      ...(options.leaderboardCapacity !== undefined
        ? { leaderboardCapacity: options.leaderboardCapacity }
        : {}),
      metadata: {
        method: request.method,
        route: request.routeOptions?.url ?? request.url,
        status_code: reply.statusCode,
      },
    });
  });
}
