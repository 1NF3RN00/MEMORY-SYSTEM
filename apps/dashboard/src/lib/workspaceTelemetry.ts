import type {
  DashboardBootstrapResponse,
  WorkspaceMetricsSummaryResponse,
} from "@memory-middleware/shared-types";
import { apiGet } from "./api.js";
import {
  TELEMETRY_COMPRESSION_LIST_FIELDS,
  TELEMETRY_CONTEXT_RENDER_LIST_FIELDS,
} from "./listFieldProjection.js";
import type { OperationalEvent, OperationalEventCategory } from "../components/homepage/types.js";
import type { IntelligencePanelData, SystemIndicators } from "../components/homepage/types.js";
import type { RankingRow } from "../components/observability/ExplainabilityPanel.js";

/**
 * Telemetry tier boundaries (Sprint-12 / DASHBOARD_LOAD_AUDIT §4).
 *
 * | Tier | Function | Load trigger | Requests |
 * |------|----------|--------------|----------|
 * | Summary | fetchTelemetrySummary | WorkspaceTelemetryProvider summary poll | 2 |
 * | Analytics | fetchTelemetryAnalytics | Observability route, intelligence panel expand | +5–6 |
 * | Full | fetchWorkspaceTelemetry | Alias for summary + analytics (Observability) | 7–8 |
 *
 * Summary: counts via pre-aggregated metrics store (Sprint-34) + stream events via bootstrap (Sprint-13).
 * Analytics: drift, operational diagnostics, heatmap, compression/context detail.
 */
export const TELEMETRY_TIER_BOUNDARIES = {
  summary: {
    description: "Tier 0–1 — shell health and trace-list counts for home indicators and stream",
    endpoints: [
      "GET /workspaces/:workspaceId/dashboard-bootstrap",
      "GET /workspaces/:workspaceId/metrics/summary",
    ],
    requestCount: 2,
    legacyEndpoints: [
      "GET /memory?workspaceId&limit=100",
      "GET /retrieval?workspaceId&limit=50",
      "GET /ingestion?workspaceId&limit=30",
      "GET /health",
    ],
  },
  analytics: {
    description: "Tier 2–3 — diagnostics, heatmap, compression/context detail (deferred on home)",
    endpoints: [
      "GET /compression?workspaceId&limit=30",
      "GET /context/render?workspaceId&limit=20",
      "GET /diagnostics/drift?workspaceId&limit=50",
      "GET /diagnostics/operational?workspaceId&limit=100&mode=slim",
      "GET /retrieval/heatmaps?workspaceId&limit=20",
      "GET /compression/:id?summary=true (conditional follow-up)",
    ],
    requestCount: "5–6",
  },
} as const;

export interface SystemMetrics {
  retrievalOps24h: number;
  avgLatencyMs: number;
  /** Mean ranking score; null when ranking breakdown was not fetched (home/sidebar load). */
  tokenEfficiency: number | null;
  memoryObjects: number;
  compressionRatio: number;
  determinismScore: string;
}

interface MemoryRow {
  id: string;
  title: string;
  memoryType: string;
  persistenceMode: string;
  archived: boolean;
}

interface TraceRow {
  retrievalTraceId?: string;
  compressionTraceId?: string;
  traceId?: string;
  deliveryId?: string;
  workspaceId?: string;
  query?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
  latencyMs?: number;
  memoryId?: string;
  sourceType?: string;
  tokenCount?: number;
}

interface CompressionTraceSummary {
  trace?: {
    compressionTraceId: string;
    compressionMetadata?: {
      originalTokens: number;
      optimizedTokens: number;
      tokenSavings: number;
      fidelityScore?: number;
    };
    fidelityReport?: { fidelityScore?: number };
    mergeCount?: number;
    trimCount?: number;
  };
}

interface DriftReport {
  report: {
    signals: Array<{ signalType: string; description: string }>;
  };
}

interface OperationalDiagnosticsSlim {
  report: {
    mode: "slim";
    counts: {
      lowConfidenceRetrievals: number;
      failedRetrievals: number;
    };
  };
}

type OperationalDiagnosticsReport =
  | OperationalDiagnosticsSlim["report"]
  | { lowConfidenceRetrievals: unknown[] };

function lowConfidenceCountFromDiagnostics(diagnostics: OperationalDiagnosticsReport): number {
  if ("mode" in diagnostics && diagnostics.mode === "slim") {
    return diagnostics.counts.lowConfidenceRetrievals;
  }
  return diagnostics.lowConfidenceRetrievals.length;
}

interface HeatmapResponse {
  entries: Array<{
    memoryId: string;
    accessCount: number;
    averageRank: number;
    averageScore: number;
  }>;
}

interface RankingResponse {
  rankingBreakdown: RankingRow[];
}

/** Raw API payloads used to assemble {@link WorkspaceTelemetry}. */
export interface TelemetrySourceBundle {
  memories: MemoryRow[];
  retrievalTraces: TraceRow[];
  ingestionTraces: TraceRow[];
  compressionTraces: TraceRow[];
  deliveryTraces: TraceRow[];
  driftSignals: DriftReport["report"]["signals"];
  diagnosticsReport: OperationalDiagnosticsReport;
  heatmapEntries: HeatmapResponse["entries"];
  healthStatus: string;
  compressionAnalytics: WorkspaceTelemetry["compressionAnalytics"];
  /** Pre-aggregated O(1) counters — Sprint-34. */
  metricsSummary?: WorkspaceMetricsSummaryResponse | null;
}

const EMPTY_INDICATORS: SystemIndicators = {
  retrievalLatencyMs: 0,
  activeMemories: 0,
  ingestionThroughput: 0,
  compressionEfficiency: 0,
  systemHealth: "nominal",
};

const EMPTY_PANEL: IntelligencePanelData = {
  activeContextWindow: {
    tokensAssembled: 0,
    compressionEfficiency: 0,
    strategicMemoriesActive: 0,
  },
  retrievalConfidence: {
    contextualConfidence: null,
    lowConfidenceCount: 0,
  },
  workspaceState: {
    activeMemories: 0,
    transientResearchMemories: 0,
    expiringContexts: 0,
  },
  operationalHistorian: {
    mostActiveScope: "—",
  },
  intelligenceDrift: {
    staleStrategicMemories: 0,
  },
};

const EMPTY_METRICS: SystemMetrics = {
  retrievalOps24h: 0,
  avgLatencyMs: 0,
  tokenEfficiency: null,
  memoryObjects: 0,
  compressionRatio: 0,
  determinismScore: "LOCKED",
};

const EMPTY_DIAGNOSTICS: OperationalDiagnosticsSlim["report"] = {
  mode: "slim",
  counts: { lowConfidenceRetrievals: 0, failedRetrievals: 0 },
};

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000;
}

function formatRelativeTime(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function categoryFromEventType(eventType: string): OperationalEventCategory {
  if (eventType.includes("ingest")) return "INGESTION";
  if (eventType.includes("retriev")) return "RETRIEVAL";
  if (eventType.includes("compress")) return "COMPRESSION";
  if (eventType.includes("reinforc")) return "REINFORCEMENT";
  return "MEMORY_HEALTH";
}

export interface WorkspaceTelemetry {
  workspaceId: string;
  indicators: SystemIndicators;
  panelData: IntelligencePanelData;
  metrics: SystemMetrics;
  events: OperationalEvent[];
  activityFeed: Array<{ id: string; type: string; label: string; memory: string; time: string }>;
  heatmap: HeatmapResponse["entries"];
  compressionAnalytics: {
    originalTokens: number;
    compressedTokens: number;
    fidelityScore?: number;
    mergeCount?: number;
    trimCount?: number;
  } | null;
  retrievalTraces: TraceRow[];
  ingestionTraces: TraceRow[];
  requestCount24h: number;
  errorRate: number;
  p99LatencyMs: number;
  tokenThroughput: number;
}

export function buildWorkspaceTelemetryFromBundle(
  workspaceId: string,
  summary: TelemetrySourceBundle,
  analytics?: Partial<TelemetrySourceBundle>,
): WorkspaceTelemetry {
  const bundle: TelemetrySourceBundle = {
    ...summary,
    compressionTraces: analytics?.compressionTraces ?? summary.compressionTraces,
    deliveryTraces: analytics?.deliveryTraces ?? summary.deliveryTraces,
    driftSignals: analytics?.driftSignals ?? summary.driftSignals,
    diagnosticsReport: analytics?.diagnosticsReport ?? summary.diagnosticsReport,
    heatmapEntries: analytics?.heatmapEntries ?? summary.heatmapEntries,
    compressionAnalytics: analytics?.compressionAnalytics ?? summary.compressionAnalytics,
  };

  const {
    memories,
    retrievalTraces,
    ingestionTraces,
    compressionTraces,
    deliveryTraces,
    driftSignals,
    diagnosticsReport,
    heatmapEntries,
    healthStatus,
    compressionAnalytics,
    metricsSummary,
  } = bundle;

  const completedRetrievals = retrievalTraces.filter((t) => t.status === "completed");
  const latencies = completedRetrievals
    .map((t) => t.latencyMs)
    .filter((v): v is number => typeof v === "number" && v > 0);
  const traceAvgLatency =
    latencies.length > 0 ? latencies.reduce((sum, v) => sum + v, 0) / latencies.length : 0;
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const traceP99LatencyMs =
    sortedLatencies.length > 0
      ? sortedLatencies[Math.min(sortedLatencies.length - 1, Math.floor(sortedLatencies.length * 0.99))]!
      : 0;

  const traceRetrievals24h = retrievalTraces.filter((t) => hoursAgo(t.createdAt) <= 24).length;
  const traceFailed24h = retrievalTraces.filter(
    (t) => t.status === "failed" && hoursAgo(t.createdAt) <= 24,
  ).length;

  const retrievals24h = metricsSummary?.retrieval.last24h ?? traceRetrievals24h;
  const failed24h = metricsSummary?.retrieval.failedLast24h ?? traceFailed24h;
  const avgLatency = metricsSummary?.retrieval.avgLatencyMs ?? traceAvgLatency;
  const p99LatencyMs = traceP99LatencyMs;
  const errorRate = retrievals24h > 0 ? failed24h / retrievals24h : 0;

  const latestDelivery = deliveryTraces.find((t) => t.status === "completed");

  const compressionEfficiency =
    compressionAnalytics && compressionAnalytics.originalTokens > 0
      ? 1 - compressionAnalytics.compressedTokens / compressionAnalytics.originalTokens
      : 0;

  const strategicMemories = memories.filter((m) => m.memoryType === "strategic").length;
  const transientResearch = memories.filter((m) => m.persistenceMode === "temporary").length;

  const topDomain =
    heatmapEntries[0]?.memoryId
      ? memories.find((m) => m.id === heatmapEntries[0]?.memoryId)?.title ?? "—"
      : memories[0]?.title ?? "—";

  const tokenThroughput = deliveryTraces
    .filter((t) => hoursAgo(t.createdAt) <= 24)
    .reduce((sum, t) => sum + (t.tokenCount ?? 0), 0);

  const ingestions24h =
    metricsSummary?.ingestion.last24h ??
    ingestionTraces.filter((t) => hoursAgo(t.createdAt) <= 24).length;
  const ingestionThroughput =
    metricsSummary?.ingestion.throughputPerHour ?? ingestions24h / 24;
  const activeMemoryCount = metricsSummary?.activeMemories ?? memories.length;

  const indicators: SystemIndicators = {
    retrievalLatencyMs: Math.round(avgLatency),
    activeMemories: activeMemoryCount,
    ingestionThroughput: Number(ingestionThroughput.toFixed(1)),
    compressionEfficiency,
    systemHealth: healthStatus === "ok" ? "nominal" : "degraded",
  };

  const panelData: IntelligencePanelData = {
    activeContextWindow: {
      tokensAssembled: latestDelivery?.tokenCount ?? 0,
      compressionEfficiency,
      strategicMemoriesActive: strategicMemories,
    },
    retrievalConfidence: {
      contextualConfidence: null,
      lowConfidenceCount: lowConfidenceCountFromDiagnostics(diagnosticsReport),
    },
    workspaceState: {
      activeMemories: activeMemoryCount,
      transientResearchMemories: transientResearch,
      expiringContexts: driftSignals.length,
    },
    operationalHistorian: {
      mostActiveScope: topDomain,
    },
    intelligenceDrift: {
      staleStrategicMemories: driftSignals.filter((s) => s.signalType.includes("stale")).length,
    },
  };

  const metrics: SystemMetrics = {
    retrievalOps24h: retrievals24h,
    avgLatencyMs: Math.round(avgLatency),
    tokenEfficiency: null,
    memoryObjects: activeMemoryCount,
    compressionRatio:
      compressionAnalytics && compressionAnalytics.originalTokens > 0
        ? compressionAnalytics.compressedTokens / compressionAnalytics.originalTokens
        : 0,
    determinismScore: "LOCKED",
  };

  const events = buildOperationalEvents({
    ingestionTraces,
    retrievalTraces,
    compressionTraces,
    driftSignals,
  });

  const activityFeed = buildActivityFeed({
    ingestionTraces,
    retrievalTraces,
    compressionTraces,
  });

  return {
    workspaceId,
    indicators,
    panelData,
    metrics,
    events,
    activityFeed,
    heatmap: heatmapEntries,
    compressionAnalytics,
    retrievalTraces,
    ingestionTraces,
    requestCount24h: retrievals24h + ingestions24h,
    errorRate,
    p99LatencyMs: Math.round(p99LatencyMs),
    tokenThroughput,
  };
}

function telemetryBundleFromDashboardBootstrap(
  bootstrap: DashboardBootstrapResponse,
): TelemetrySourceBundle {
  return {
    memories: bootstrap.memories,
    retrievalTraces: bootstrap.retrievalTraces,
    ingestionTraces: bootstrap.ingestionTraces.map((trace) => ({
      traceId: trace.traceId,
      workspaceId: trace.workspaceId,
      memoryId: trace.memoryId ?? undefined,
      status: trace.status,
      sourceType: trace.sourceType ?? undefined,
      createdAt: trace.createdAt,
    })),
    compressionTraces: [],
    deliveryTraces: [],
    driftSignals: [],
    diagnosticsReport: EMPTY_DIAGNOSTICS,
    heatmapEntries: [],
    healthStatus: bootstrap.health.status,
    compressionAnalytics: null,
    metricsSummary: null,
  };
}

/** Pre-aggregated workspace counters — O(1) DB read (Sprint-34). */
export async function fetchWorkspaceMetricsSummary(
  workspaceId: string,
): Promise<WorkspaceMetricsSummaryResponse | null> {
  if (!workspaceId) return null;

  try {
    return await apiGet<WorkspaceMetricsSummaryResponse>(
      `/workspaces/${workspaceId}/metrics/summary`,
    );
  } catch {
    return null;
  }
}

/** Summary tier — single batched bootstrap request (Sprint-13). */
export async function fetchDashboardBootstrap(
  workspaceId: string,
): Promise<DashboardBootstrapResponse | null> {
  if (!workspaceId) return null;

  try {
    return await apiGet<DashboardBootstrapResponse>(
      `/workspaces/${workspaceId}/dashboard-bootstrap`,
    );
  } catch {
    return null;
  }
}

function emptySummaryTelemetryBundle(healthStatus = "degraded"): TelemetrySourceBundle {
  return {
    memories: [],
    retrievalTraces: [],
    ingestionTraces: [],
    compressionTraces: [],
    deliveryTraces: [],
    driftSignals: [],
    diagnosticsReport: EMPTY_DIAGNOSTICS,
    heatmapEntries: [],
    healthStatus,
    compressionAnalytics: null,
    metricsSummary: null,
  };
}

export async function fetchTelemetrySummaryBundle(
  workspaceId: string,
): Promise<TelemetrySourceBundle | null> {
  if (!workspaceId) return null;

  const [bootstrap, metricsSummary] = await Promise.all([
    fetchDashboardBootstrap(workspaceId),
    fetchWorkspaceMetricsSummary(workspaceId),
  ]);

  if (!bootstrap) {
    const empty = emptySummaryTelemetryBundle();
    return { ...empty, metricsSummary };
  }

  return {
    ...telemetryBundleFromDashboardBootstrap(bootstrap),
    metricsSummary,
  };
}

async function loadCompressionAnalytics(
  compressionTraces: TraceRow[],
): Promise<WorkspaceTelemetry["compressionAnalytics"]> {
  const latestCompressionId = compressionTraces[0]?.compressionTraceId;
  if (!latestCompressionId) return null;

  const detail = await apiGet<CompressionTraceSummary>(
    `/compression/${latestCompressionId}?summary=true`,
  ).catch(() => null);
  if (!detail?.trace) return null;

  const meta = detail.trace.compressionMetadata;
  const fidelityScore = detail.trace.fidelityReport?.fidelityScore ?? meta?.fidelityScore;
  return {
    originalTokens: meta?.originalTokens ?? 0,
    compressedTokens: meta?.optimizedTokens ?? 0,
    ...(fidelityScore !== undefined ? { fidelityScore } : {}),
    ...(detail.trace.mergeCount !== undefined ? { mergeCount: detail.trace.mergeCount } : {}),
    ...(detail.trace.trimCount !== undefined ? { trimCount: detail.trace.trimCount } : {}),
  };
}

export async function fetchTelemetryAnalyticsBundle(
  workspaceId: string,
): Promise<Partial<TelemetrySourceBundle> | null> {
  if (!workspaceId) return null;

  const [compressionsRes, deliveriesRes, driftRes, diagnosticsRes, heatmapRes] = await Promise.all([
    apiGet<{ traces: TraceRow[] }>(
      `/compression?workspaceId=${workspaceId}&limit=30&fields=${TELEMETRY_COMPRESSION_LIST_FIELDS}`,
    ).catch(() => ({
      traces: [],
    })),
    apiGet<{ traces: TraceRow[] }>(
      `/context/render?workspaceId=${workspaceId}&limit=20&fields=${TELEMETRY_CONTEXT_RENDER_LIST_FIELDS}`,
    ).catch(() => ({
      traces: [],
    })),
    apiGet<DriftReport>(`/diagnostics/drift?workspaceId=${workspaceId}&limit=50`).catch(() => ({
      report: { signals: [] },
    })),
    apiGet<OperationalDiagnosticsSlim>(
      `/diagnostics/operational?workspaceId=${workspaceId}&limit=100&mode=slim`,
    ).catch(() => ({
      report: EMPTY_DIAGNOSTICS,
    })),
    apiGet<HeatmapResponse>(`/retrieval/heatmaps?workspaceId=${workspaceId}&limit=20`).catch(() => ({
      entries: [],
    })),
  ]);

  const compressionAnalytics = await loadCompressionAnalytics(compressionsRes.traces);

  return {
    compressionTraces: compressionsRes.traces,
    deliveryTraces: deliveriesRes.traces,
    driftSignals: driftRes.report.signals,
    diagnosticsReport: diagnosticsRes.report,
    heatmapEntries: heatmapRes.entries,
    compressionAnalytics,
  };
}

/** Summary tier — single bootstrap request. Used by WorkspaceTelemetryProvider. */
export async function fetchTelemetrySummary(
  workspaceId: string,
): Promise<WorkspaceTelemetry | null> {
  try {
    const bundle = await fetchTelemetrySummaryBundle(workspaceId);
    if (!bundle) return null;
    return buildWorkspaceTelemetryFromBundle(workspaceId, bundle);
  } catch {
    return null;
  }
}

/** Analytics tier — 5–6 requests. Merges with an existing summary bundle when provided. */
export async function fetchTelemetryAnalytics(
  workspaceId: string,
  summaryBundle?: TelemetrySourceBundle | null,
): Promise<WorkspaceTelemetry | null> {
  try {
    const [summary, analytics] = await Promise.all([
      summaryBundle ? Promise.resolve(summaryBundle) : fetchTelemetrySummaryBundle(workspaceId),
      fetchTelemetryAnalyticsBundle(workspaceId),
    ]);
    if (!summary || !analytics) return null;
    return buildWorkspaceTelemetryFromBundle(workspaceId, summary, analytics);
  } catch {
    return null;
  }
}

/** Full telemetry — summary + analytics. Preserves Observability / backward-compatible contract. */
export async function fetchWorkspaceTelemetry(
  workspaceId: string,
): Promise<WorkspaceTelemetry | null> {
  return fetchTelemetryAnalytics(workspaceId);
}

function buildOperationalEvents(input: {
  ingestionTraces: TraceRow[];
  retrievalTraces: TraceRow[];
  compressionTraces: TraceRow[];
  driftSignals: Array<{ signalType: string; description: string }>;
}): OperationalEvent[] {
  const events: OperationalEvent[] = [];

  for (const trace of input.ingestionTraces.slice(0, 8)) {
    events.push({
      id: `ing-${trace.traceId}`,
      category: "INGESTION",
      title: trace.status === "completed" ? "Ingestion completed" : `Ingestion ${trace.status}`,
      detail: trace.memoryId ? `Memory ${trace.memoryId.slice(0, 12)}…` : trace.sourceType ?? "—",
      timestamp: new Date(trace.createdAt),
      metadata: {
        trace: trace.traceId?.slice(0, 12) ?? "—",
        source: trace.sourceType ?? "—",
      },
      lineage: "ingest → normalize → chunk",
      source: trace.memoryId ?? trace.traceId ?? "—",
    });
  }

  for (const trace of input.retrievalTraces.slice(0, 8)) {
    events.push({
      id: `ret-${trace.retrievalTraceId}`,
      category: "RETRIEVAL",
      title: trace.query ? trace.query.slice(0, 64) : "Retrieval executed",
      detail: `${trace.status}${trace.latencyMs ? ` · ${trace.latencyMs}ms` : ""}`,
      timestamp: new Date(trace.createdAt),
      metadata: {
        trace: trace.retrievalTraceId?.slice(0, 12) ?? "—",
        status: trace.status,
      },
      lineage: "vector → rerank → dedup → assemble",
      source: trace.retrievalTraceId ?? "—",
    });
  }

  for (const trace of input.compressionTraces.slice(0, 6)) {
    events.push({
      id: `cmp-${trace.compressionTraceId}`,
      category: "COMPRESSION",
      title: `Compression ${trace.status}`,
      detail: trace.compressionTraceId?.slice(0, 16) ?? "—",
      timestamp: new Date(trace.createdAt),
      metadata: { trace: trace.compressionTraceId?.slice(0, 12) ?? "—" },
      lineage: "overlap → merge → trim",
      source: trace.compressionTraceId ?? "—",
    });
  }

  for (const [index, signal] of input.driftSignals.slice(0, 4).entries()) {
    events.push({
      id: `drift-${index}`,
      category: "MEMORY_HEALTH",
      title: signal.description.slice(0, 72),
      detail: signal.signalType.replace(/_/g, " "),
      timestamp: new Date(),
      metadata: { type: signal.signalType },
      lineage: "historian → drift scan",
      source: "operational historian",
    });
  }

  return events
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 24);
}

function buildActivityFeed(input: {
  ingestionTraces: TraceRow[];
  retrievalTraces: TraceRow[];
  compressionTraces: TraceRow[];
}) {
  const items: WorkspaceTelemetry["activityFeed"] = [];

  for (const trace of input.ingestionTraces.slice(0, 3)) {
    items.push({
      id: trace.traceId ?? trace.memoryId ?? crypto.randomUUID(),
      type: "ingest",
      label: trace.status === "completed" ? "Ingestion completed" : `Ingestion ${trace.status}`,
      memory: trace.memoryId?.slice(0, 16) ?? trace.sourceType ?? "—",
      time: formatRelativeTime(trace.createdAt),
    });
  }

  for (const trace of input.retrievalTraces.slice(0, 3)) {
    items.push({
      id: trace.retrievalTraceId ?? crypto.randomUUID(),
      type: "retrieve",
      label: "Retrieval executed",
      memory: trace.retrievalTraceId?.slice(0, 16) ?? "—",
      time: formatRelativeTime(trace.createdAt),
    });
  }

  for (const trace of input.compressionTraces.slice(0, 2)) {
    items.push({
      id: trace.compressionTraceId ?? crypto.randomUUID(),
      type: "compress",
      label: `Compression ${trace.status}`,
      memory: trace.compressionTraceId?.slice(0, 16) ?? "—",
      time: formatRelativeTime(trace.createdAt),
    });
  }

  return items.sort((a, b) => {
    const parse = (s: string) => {
      const n = Number.parseInt(s, 10);
      if (s.endsWith("s ago")) return n;
      if (s.endsWith("m ago")) return n * 60;
      if (s.endsWith("h ago")) return n * 3600;
      return n * 86400;
    };
    return parse(a.time) - parse(b.time);
  });
}

export function emptyWorkspaceTelemetry(): WorkspaceTelemetry {
  return {
    workspaceId: "",
    indicators: EMPTY_INDICATORS,
    panelData: EMPTY_PANEL,
    metrics: EMPTY_METRICS,
    events: [],
    activityFeed: [],
    heatmap: [],
    compressionAnalytics: null,
    retrievalTraces: [],
    ingestionTraces: [],
    requestCount24h: 0,
    errorRate: 0,
    p99LatencyMs: 0,
    tokenThroughput: 0,
  };
}

/** On-demand ranking breakdown for Observability / trace detail views — not part of home telemetry. */
export async function fetchRankingBreakdown(retrievalTraceId: string): Promise<RankingRow[]> {
  if (!retrievalTraceId) return [];

  const ranking = await apiGet<RankingResponse>(`/retrieval/${retrievalTraceId}/ranking`).catch(
    () => ({ rankingBreakdown: [] }),
  );
  return ranking.rankingBreakdown.slice(0, 5);
}

export { formatRelativeTime, categoryFromEventType };
