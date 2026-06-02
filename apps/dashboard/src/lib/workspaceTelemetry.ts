import { apiGet } from "./api.js";
import type { OperationalEvent, OperationalEventCategory } from "../components/homepage/types.js";
import type { IntelligencePanelData, SystemIndicators } from "../components/homepage/types.js";
import type { RankingRow } from "../components/observability/ExplainabilityPanel.js";

export interface SystemMetrics {
  retrievalOps24h: number;
  avgLatencyMs: number;
  tokenEfficiency: number;
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

interface CompressionTraceDetail {
  trace?: {
    compressionTraceId: string;
    optimizedContextPackage?: {
      compressionMetadata?: {
        originalTokens: number;
        optimizedTokens: number;
        tokenSavings: number;
      };
    };
    fidelityReport?: { overallScore?: number };
    mergeDecisions?: unknown[];
    trimmingDecisions?: unknown[];
  };
}

interface DriftReport {
  report: {
    signals: Array<{ signalType: string; description: string }>;
  };
}

interface OperationalDiagnostics {
  report: {
    lowConfidenceRetrievals: unknown[];
    failedRetrievals: unknown[];
  };
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
    contextualConfidence: 0,
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
  tokenEfficiency: 0,
  memoryObjects: 0,
  compressionRatio: 0,
  determinismScore: "LOCKED",
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
  rankingRows: RankingRow[];
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

export async function fetchWorkspaceTelemetry(): Promise<WorkspaceTelemetry | null> {
  try {
    const workspace = await apiGet<{ id: string }>("/workspaces/default");
    const workspaceId = workspace.id;

    const [
      memoriesRes,
      retrievalsRes,
      ingestionsRes,
      compressionsRes,
      deliveriesRes,
      driftRes,
      diagnosticsRes,
      heatmapRes,
      healthRes,
    ] = await Promise.all([
      apiGet<{ memories: MemoryRow[] }>(`/memory?workspaceId=${workspaceId}&limit=100`).catch(() => ({
        memories: [],
      })),
      apiGet<{ traces: TraceRow[] }>(`/retrieval?workspaceId=${workspaceId}&limit=50`).catch(() => ({
        traces: [],
      })),
      apiGet<{ traces: TraceRow[] }>(`/ingestion?workspaceId=${workspaceId}&limit=30`).catch(() => ({
        traces: [],
      })),
      apiGet<{ traces: TraceRow[] }>(`/compression?workspaceId=${workspaceId}&limit=30`).catch(() => ({
        traces: [],
      })),
      apiGet<{ traces: TraceRow[] }>(`/context/render?workspaceId=${workspaceId}&limit=20`).catch(() => ({
        traces: [],
      })),
      apiGet<DriftReport>(`/diagnostics/drift?workspaceId=${workspaceId}&limit=50`).catch(() => ({
        report: { signals: [] },
      })),
      apiGet<OperationalDiagnostics>(`/diagnostics/operational?workspaceId=${workspaceId}&limit=100`).catch(
        () => ({ report: { lowConfidenceRetrievals: [], failedRetrievals: [] } }),
      ),
      apiGet<HeatmapResponse>(`/retrieval/heatmaps?workspaceId=${workspaceId}&limit=20`).catch(() => ({
        entries: [],
      })),
      apiGet<{ status: string }>("/health").catch(() => ({ status: "degraded" })),
    ]);

    const memories = memoriesRes.memories;
    const retrievalTraces = retrievalsRes.traces;
    const ingestionTraces = ingestionsRes.traces;
    const compressionTraces = compressionsRes.traces;
    const deliveryTraces = deliveriesRes.traces;

    const completedRetrievals = retrievalTraces.filter((t) => t.status === "completed");
    const latencies = completedRetrievals
      .map((t) => t.latencyMs)
      .filter((v): v is number => typeof v === "number" && v > 0);
    const avgLatency =
      latencies.length > 0
        ? latencies.reduce((sum, v) => sum + v, 0) / latencies.length
        : 0;
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p99LatencyMs =
      sortedLatencies.length > 0
        ? sortedLatencies[Math.min(sortedLatencies.length - 1, Math.floor(sortedLatencies.length * 0.99))]!
        : 0;

    const retrievals24h = retrievalTraces.filter((t) => hoursAgo(t.createdAt) <= 24).length;
    const failed24h = retrievalTraces.filter(
      (t) => t.status === "failed" && hoursAgo(t.createdAt) <= 24,
    ).length;
    const errorRate = retrievals24h > 0 ? failed24h / retrievals24h : 0;

    const latestDelivery = deliveryTraces.find((t) => t.status === "completed");
    const latestCompressionId = compressionTraces[0]?.compressionTraceId;
    let compressionAnalytics: WorkspaceTelemetry["compressionAnalytics"] = null;

    if (latestCompressionId) {
      const detail = await apiGet<CompressionTraceDetail>(`/compression/${latestCompressionId}`).catch(
        () => null,
      );
      if (detail?.trace) {
        const meta = detail.trace.optimizedContextPackage?.compressionMetadata;
        const fidelityScore = detail.trace.fidelityReport?.overallScore;
        const mergeCount = detail.trace.mergeDecisions?.length;
        const trimCount = detail.trace.trimmingDecisions?.length;
        compressionAnalytics = {
          originalTokens: meta?.originalTokens ?? 0,
          compressedTokens: meta?.optimizedTokens ?? 0,
          ...(fidelityScore !== undefined ? { fidelityScore } : {}),
          ...(mergeCount !== undefined ? { mergeCount } : {}),
          ...(trimCount !== undefined ? { trimCount } : {}),
        };
      }
    }

    const latestRetrievalId = completedRetrievals[0]?.retrievalTraceId;
    let rankingRows: RankingRow[] = [];
    if (latestRetrievalId) {
      const ranking = await apiGet<RankingResponse>(`/retrieval/${latestRetrievalId}/ranking`).catch(
        () => ({ rankingBreakdown: [] }),
      );
      rankingRows = ranking.rankingBreakdown.slice(0, 5);
    }

    const compressionEfficiency =
      compressionAnalytics && compressionAnalytics.originalTokens > 0
        ? 1 - compressionAnalytics.compressedTokens / compressionAnalytics.originalTokens
        : 0;

    const strategicMemories = memories.filter((m) => m.memoryType === "strategic").length;
    const transientResearch = memories.filter((m) => m.persistenceMode === "temporary").length;

    const topDomain =
      heatmapRes.entries[0]?.memoryId
        ? memories.find((m) => m.id === heatmapRes.entries[0]?.memoryId)?.title ?? "—"
        : memories[0]?.title ?? "—";

    const avgConfidence =
      rankingRows.length > 0
        ? rankingRows.reduce((sum, row) => sum + row.finalScore, 0) / rankingRows.length
        : 0;

    const tokenThroughput = deliveryTraces
      .filter((t) => hoursAgo(t.createdAt) <= 24)
      .reduce((sum, t) => sum + (t.tokenCount ?? 0), 0);

    const ingestions24h = ingestionTraces.filter((t) => hoursAgo(t.createdAt) <= 24).length;
    const ingestionThroughput = ingestions24h / 24;

    const indicators: SystemIndicators = {
      retrievalLatencyMs: Math.round(avgLatency),
      activeMemories: memories.length,
      ingestionThroughput: Number(ingestionThroughput.toFixed(1)),
      compressionEfficiency,
      systemHealth: healthRes.status === "ok" ? "nominal" : "degraded",
    };

    const panelData: IntelligencePanelData = {
      activeContextWindow: {
        tokensAssembled: latestDelivery?.tokenCount ?? 0,
        compressionEfficiency,
        strategicMemoriesActive: strategicMemories,
      },
      retrievalConfidence: {
        contextualConfidence: avgConfidence,
        lowConfidenceCount: diagnosticsRes.report.lowConfidenceRetrievals.length,
      },
      workspaceState: {
        activeMemories: memories.length,
        transientResearchMemories: transientResearch,
        expiringContexts: driftRes.report.signals.length,
      },
      operationalHistorian: {
        mostActiveScope: topDomain,
      },
      intelligenceDrift: {
        staleStrategicMemories: driftRes.report.signals.filter((s) =>
          s.signalType.includes("stale"),
        ).length,
      },
    };

    const metrics: SystemMetrics = {
      retrievalOps24h: retrievals24h,
      avgLatencyMs: Math.round(avgLatency),
      tokenEfficiency: avgConfidence,
      memoryObjects: memories.length,
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
      driftSignals: driftRes.report.signals,
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
      heatmap: heatmapRes.entries,
      rankingRows,
      compressionAnalytics,
      retrievalTraces,
      ingestionTraces,
      requestCount24h: retrievals24h + ingestions24h,
      errorRate,
      p99LatencyMs: Math.round(p99LatencyMs),
      tokenThroughput,
    };
  } catch {
    return null;
  }
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
    rankingRows: [],
    compressionAnalytics: null,
    retrievalTraces: [],
    ingestionTraces: [],
    requestCount24h: 0,
    errorRate: 0,
    p99LatencyMs: 0,
    tokenThroughput: 0,
  };
}

export { formatRelativeTime, categoryFromEventType };
