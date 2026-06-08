/**
 * Sprint-13 dashboard bootstrap contracts.
 *
 * GET /workspaces/:workspaceId/dashboard-bootstrap
 *
 * Returns slim summary-tier payloads for dashboard shell load (home indicators,
 * operational stream, metrics sidebar). Does not include full trace bodies,
 * ranking breakdowns, compression context packages, or relationship graphs.
 */

export type DashboardBootstrapHealthStatus = "ok" | "degraded";

export interface DashboardBootstrapMemorySummary {
  id: string;
  title: string;
  memoryType: string;
  persistenceMode: string;
  archived: boolean;
}

export interface DashboardBootstrapRetrievalTraceSummary {
  retrievalTraceId: string;
  workspaceId: string;
  query: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  latencyMs?: number;
}

export interface DashboardBootstrapIngestionTraceSummary {
  traceId: string;
  workspaceId: string;
  memoryId: string | null;
  status: string;
  sourceType: string | null;
  createdAt: string;
}

export interface DashboardBootstrapHealth {
  status: DashboardBootstrapHealthStatus;
  timestamp: string;
  trace_id?: string;
}

/** Summary tier — replaces parallel memory/retrieval/ingestion/health list calls on dashboard load. */
export interface DashboardBootstrapResponse {
  workspaceId: string;
  tier: "summary";
  memories: DashboardBootstrapMemorySummary[];
  retrievalTraces: DashboardBootstrapRetrievalTraceSummary[];
  ingestionTraces: DashboardBootstrapIngestionTraceSummary[];
  health: DashboardBootstrapHealth;
}
