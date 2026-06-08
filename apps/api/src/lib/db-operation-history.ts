import type { DbOperationLeaderboardEntry } from "@memory-middleware/shared-types";
import {
  DB_SCOPE_COMPLETED_EVENT_TYPE,
  queryLeaderboardFromEventLogRows,
} from "@memory-middleware/observability";
import type { PrismaClient } from "@prisma/client";

export interface DbOperationHistoryQueryOptions {
  limit: number;
  offset?: number;
  scopeType?: string;
  windowSize: number;
}

export interface DbOperationHistoryResult {
  entries: DbOperationLeaderboardEntry[];
  scannedCount: number;
  windowSize: number;
}

export async function queryDbOperationHistoryFromEventLog(
  prisma: PrismaClient,
  options: DbOperationHistoryQueryOptions,
): Promise<DbOperationHistoryResult> {
  const windowSize = Math.max(1, Math.trunc(options.windowSize));

  const events = await prisma.eventLog.findMany({
    where: { eventType: DB_SCOPE_COMPLETED_EVENT_TYPE },
    orderBy: { timestamp: "desc" },
    take: windowSize,
    select: {
      traceId: true,
      timestamp: true,
      payload: true,
    },
  });

  const entries = queryLeaderboardFromEventLogRows(events, {
    limit: options.limit,
    offset: options.offset ?? 0,
    ...(options.scopeType ? { scopeType: options.scopeType } : {}),
  });

  return {
    entries,
    scannedCount: events.length,
    windowSize,
  };
}
