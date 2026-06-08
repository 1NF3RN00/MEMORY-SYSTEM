import type { DbScopeSummary } from "@memory-middleware/shared-types";
import type { Logger } from "../logger.js";
import type { EventEmitter } from "../events/event-emitter.js";
import { getDbOperationLeaderboard } from "./leaderboard.js";
import { isoNow } from "../timing/hrtime.js";

export interface EmitDbScopeCompletedOptions {
  leaderboardCapacity?: number;
  metadata?: Record<string, unknown>;
}

export async function emitDbScopeCompleted(
  logger: Logger,
  events: EventEmitter | undefined,
  summary: DbScopeSummary,
  options: EmitDbScopeCompletedOptions = {},
): Promise<void> {
  const completedAt = isoNow();
  const slowQueryCount = summary.slowQueries.length;
  const duplicateQueryCount = summary.duplicateQueries.length;
  const nPlusOneCount = summary.nPlusOnePatterns.length;

  logger.info(
    {
      event: "database.scope.completed",
      scope_id: summary.scopeId,
      scope_type: summary.scopeType,
      total_queries: summary.totalQueries,
      total_db_time_ms: summary.totalDbTime,
      slow_query_count: slowQueryCount,
      duplicate_query_count: duplicateQueryCount,
      n_plus_one_count: nPlusOneCount,
      completed_at: completedAt,
      ...options.metadata,
    },
    "database.scope.completed",
  );

  if (events) {
    await events.emit({
      event_type: "database.scope.completed",
      trace_id: summary.scopeId,
      metadata: {
        scopeType: summary.scopeType,
        totalQueries: summary.totalQueries,
        totalDbTime: summary.totalDbTime,
        slowQueries: summary.slowQueries,
        duplicateQueries: summary.duplicateQueries,
        nPlusOnePatterns: summary.nPlusOnePatterns,
        slowQueryCount,
        duplicateQueryCount,
        nPlusOneCount,
        completedAt,
        ...options.metadata,
      },
    });
  }

  const leaderboard = getDbOperationLeaderboard(options.leaderboardCapacity);
  leaderboard.push(summary, completedAt);
}
