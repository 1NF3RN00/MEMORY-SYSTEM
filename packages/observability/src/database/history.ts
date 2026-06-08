import type { DbOperationLeaderboardEntry } from "@memory-middleware/shared-types";

export const DB_SCOPE_COMPLETED_EVENT_TYPE = "database.scope.completed";

export interface EventLogDbScopeRow {
  traceId: string;
  timestamp: Date | string;
  payload: unknown;
}

export function parseEventLogDbScopeEntry(
  row: EventLogDbScopeRow,
): DbOperationLeaderboardEntry | null {
  if (!row.payload || typeof row.payload !== "object") {
    return null;
  }

  const record = row.payload as Record<string, unknown>;
  const metadata = record.metadata;
  if (!metadata || typeof metadata !== "object") {
    return null;
  }

  const meta = metadata as Record<string, unknown>;
  const totalDbTime = meta.totalDbTime;
  const totalQueries = meta.totalQueries;
  const scopeType = meta.scopeType;

  if (typeof totalDbTime !== "number" || !Number.isFinite(totalDbTime)) {
    return null;
  }
  if (typeof totalQueries !== "number" || !Number.isFinite(totalQueries)) {
    return null;
  }
  if (typeof scopeType !== "string") {
    return null;
  }

  const scopeId = typeof record.trace_id === "string" ? record.trace_id : row.traceId;
  const completedAt =
    typeof meta.completedAt === "string"
      ? meta.completedAt
      : typeof row.timestamp === "string"
        ? row.timestamp
        : row.timestamp.toISOString();

  return {
    scopeId,
    scopeType,
    totalDbTime,
    totalQueries,
    slowQueryCount: typeof meta.slowQueryCount === "number" ? meta.slowQueryCount : 0,
    duplicateQueryCount:
      typeof meta.duplicateQueryCount === "number" ? meta.duplicateQueryCount : 0,
    nPlusOneCount: typeof meta.nPlusOneCount === "number" ? meta.nPlusOneCount : 0,
    completedAt,
  };
}

export function paginateLeaderboardEntries(
  entries: DbOperationLeaderboardEntry[],
  options: { limit: number; offset?: number; scopeType?: string },
): DbOperationLeaderboardEntry[] {
  let filtered = entries;
  if (options.scopeType) {
    filtered = filtered.filter((entry) => entry.scopeType === options.scopeType);
  }

  const sorted = [...filtered].sort((left, right) => right.totalDbTime - left.totalDbTime);
  const offset = options.offset ?? 0;
  return sorted.slice(offset, offset + options.limit);
}

export function queryLeaderboardFromEventLogRows(
  rows: EventLogDbScopeRow[],
  options: { limit: number; offset?: number; scopeType?: string },
): DbOperationLeaderboardEntry[] {
  const entries: DbOperationLeaderboardEntry[] = [];
  for (const row of rows) {
    const entry = parseEventLogDbScopeEntry(row);
    if (entry) {
      entries.push(entry);
    }
  }

  return paginateLeaderboardEntries(entries, options);
}
