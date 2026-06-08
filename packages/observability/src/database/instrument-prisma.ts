import { PrismaClient } from "@prisma/client";
import type { Logger } from "../logger.js";
import { registerSlowQueryExplainHook } from "./explain-on-slow.js";
import { getDbQueryAggregator, recordScopedQuery } from "./scope.js";

const EXCLUDED_MODELS = new Set(["EventLog"]);

export interface InstrumentPrismaOptions {
  enabled?: boolean;
  slowQueryMs?: number;
  nPlusOneThreshold?: number;
  explainOnSlow?: boolean;
  explainAnalyze?: boolean;
  logger?: Logger;
}

export type InstrumentedPrismaClient = PrismaClient;

export function createInstrumentedPrismaClient(
  options: InstrumentPrismaOptions = {},
): InstrumentedPrismaClient {
  const enabled = options.enabled ?? true;
  const slowQueryMs = options.slowQueryMs ?? 100;
  const explainOnSlow = options.explainOnSlow ?? false;
  const logger = options.logger;

  const baseClient = explainOnSlow
    ? new PrismaClient({ log: [{ emit: "event", level: "query" }] })
    : new PrismaClient();

  if (!enabled) {
    return baseClient;
  }

  if (explainOnSlow && logger) {
    registerSlowQueryExplainHook({
      client: baseClient,
      logger,
      slowQueryMs,
      ...(options.explainAnalyze !== undefined ? { analyze: options.explainAnalyze } : {}),
    });
  }

  const extended = baseClient.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (EXCLUDED_MODELS.has(model)) {
            return query(args);
          }

          const start = performance.now();
          const result = await query(args);
          const durationMs = performance.now() - start;

          const record = recordScopedQuery({
            model,
            operation,
            args,
            durationMs,
          });

          if (logger && record) {
            const scope = getDbQueryAggregator();
            const payload = {
              event: "database.query.completed",
              ...(scope
                ? {
                    scope_id: scope.getScopeId(),
                    scope_type: scope.getScopeType(),
                  }
                : {}),
              model,
              operation,
              duration_ms: durationMs,
              is_slow: record.isSlow,
              fingerprint: record.fingerprint,
            };

            if (record.isSlow) {
              logger.warn(payload, "database.query.completed");
            } else {
              logger.debug(payload, "database.query.completed");
            }
          }

          return result;
        },
      },
    },
  });

  return extended as unknown as InstrumentedPrismaClient;
}
