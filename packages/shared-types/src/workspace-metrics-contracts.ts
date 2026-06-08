/**
 * Sprint-34 workspace metrics aggregation contracts.
 *
 * GET /workspaces/:workspaceId/metrics/summary
 *
 * Pre-aggregated counters — O(1) read by workspace ID. Does not include
 * trace bodies, ranking breakdowns, or historian payloads.
 */

export interface WorkspaceOperationCounts {
  total: number;
  completed: number;
  failed: number;
}

export interface WorkspaceRetrievalMetrics extends WorkspaceOperationCounts {
  last24h: number;
  failedLast24h: number;
  avgLatencyMs: number;
}

export interface WorkspaceIngestionMetrics extends WorkspaceOperationCounts {
  last24h: number;
  throughputPerHour: number;
}

export interface WorkspaceMetricsSummaryResponse {
  workspaceId: string;
  activeMemories: number;
  retrieval: WorkspaceRetrievalMetrics;
  ingestion: WorkspaceIngestionMetrics;
  compression: WorkspaceOperationCounts;
  contextRender: WorkspaceOperationCounts;
  updatedAt: string;
}
