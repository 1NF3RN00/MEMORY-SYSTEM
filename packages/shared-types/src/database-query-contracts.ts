export interface DbQueryRecord {
  queryId: string;
  model: string;
  operation: string;
  durationMs: number;
  fingerprint: string;
  isSlow: boolean;
  timestamp: string;
}

export interface DbDuplicateQueryGroup {
  fingerprint: string;
  count: number;
  totalDurationMs: number;
  sample: DbQueryRecord;
}

export interface DbNPlusOnePattern {
  fingerprint: string;
  count: number;
  model: string;
  operation: string;
}

export interface DbScopeSummary {
  scopeId: string;
  scopeType: "retrieval" | "request" | "worker" | "other";
  totalQueries: number;
  totalDbTime: number;
  slowQueries: DbQueryRecord[];
  duplicateQueries: DbDuplicateQueryGroup[];
  nPlusOnePatterns: DbNPlusOnePattern[];
}

/** Required retrieval output shape */
export interface RetrievalDbObservability {
  retrievalId: string;
  totalQueries: number;
  totalDbTime: number;
  slowQueries: DbQueryRecord[];
  duplicateQueries: DbDuplicateQueryGroup[];
}

export interface DbOperationLeaderboardEntry {
  scopeId: string;
  scopeType: string;
  totalDbTime: number;
  totalQueries: number;
  slowQueryCount: number;
  duplicateQueryCount: number;
  nPlusOneCount: number;
  completedAt: string;
}
