import type {
  DbOperationLeaderboardEntry,
  DbScopeSummary,
} from "@memory-middleware/shared-types";
import { isoNow } from "../timing/hrtime.js";

export function summaryToLeaderboardEntry(
  summary: DbScopeSummary,
  completedAt?: string,
): DbOperationLeaderboardEntry {
  return {
    scopeId: summary.scopeId,
    scopeType: summary.scopeType,
    totalDbTime: summary.totalDbTime,
    totalQueries: summary.totalQueries,
    slowQueryCount: summary.slowQueries.length,
    duplicateQueryCount: summary.duplicateQueries.length,
    nPlusOneCount: summary.nPlusOnePatterns.length,
    completedAt: completedAt ?? isoNow(),
  };
}

export class DbOperationLeaderboard {
  private entries: DbOperationLeaderboardEntry[] = [];
  private readonly capacity: number;

  constructor(capacity = 500) {
    this.capacity = capacity;
  }

  push(summary: DbScopeSummary, completedAt?: string): void {
    this.entries.push(summaryToLeaderboardEntry(summary, completedAt));
    if (this.entries.length > this.capacity) {
      this.entries.shift();
    }
  }

  getTop(limit = 20, scopeType?: string): DbOperationLeaderboardEntry[] {
    let filtered = this.entries;
    if (scopeType) {
      filtered = filtered.filter((entry) => entry.scopeType === scopeType);
    }

    return [...filtered]
      .sort((left, right) => right.totalDbTime - left.totalDbTime)
      .slice(0, limit);
  }

  size(): number {
    return this.entries.length;
  }

  reset(): void {
    this.entries = [];
  }
}

let globalLeaderboard: DbOperationLeaderboard | undefined;

export function getDbOperationLeaderboard(capacity?: number): DbOperationLeaderboard {
  if (!globalLeaderboard) {
    globalLeaderboard = new DbOperationLeaderboard(capacity ?? 500);
  }
  return globalLeaderboard;
}

export function resetDbOperationLeaderboardForTests(): void {
  globalLeaderboard = undefined;
}
