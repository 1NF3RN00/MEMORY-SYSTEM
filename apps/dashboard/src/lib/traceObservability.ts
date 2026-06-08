import type {
  ExecutionTimingAudit,
  LlmCallAudit,
  RetrievalDbObservability,
} from "@memory-middleware/shared-types";
import type { StageRecord } from "../components/observability/RetrievalTimeline.js";
import { formatDurationMs, resolveTimelineStages } from "./timelineTiming.js";

export type ObservabilitySubview = "timing" | "llm" | "db";

export interface TraceObservabilityInput {
  stages?: StageRecord[];
  timingAudit?: ExecutionTimingAudit;
  legacyTotalLatencyMs?: number;
  llmCallAudit?: LlmCallAudit;
  dbObservability?: RetrievalDbObservability;
}

export interface ObservabilitySummary {
  timingMs?: number;
  timingSource?: "hrtime" | "legacy" | "none";
  llmCalls: number;
  llmTokens: number;
  llmCostUsd: number;
  dbQueries: number;
  dbTimeMs: number;
  slowQueryCount: number;
  duplicateQueryCount: number;
}

export function buildObservabilitySummary(input: TraceObservabilityInput): ObservabilitySummary {
  const resolved = resolveTimelineStages({
    ...(input.timingAudit ? { timingAudit: input.timingAudit } : {}),
    ...(input.stages ? { legacyStages: input.stages } : {}),
    ...(input.legacyTotalLatencyMs != null
      ? { legacyTotalLatencyMs: input.legacyTotalLatencyMs }
      : {}),
  });

  const llm = input.llmCallAudit;
  const db = input.dbObservability;

  return {
    ...(resolved.totalLatencyMs != null
      ? {
          timingMs: resolved.totalLatencyMs,
          timingSource: resolved.source,
        }
      : { timingSource: "none" as const }),
    llmCalls: llm?.calls.length ?? 0,
    llmTokens: (llm?.totalPromptTokens ?? 0) + (llm?.totalCompletionTokens ?? 0),
    llmCostUsd: llm?.totalCostUsd ?? 0,
    dbQueries: db?.totalQueries ?? 0,
    dbTimeMs: db?.totalDbTime ?? 0,
    slowQueryCount: db?.slowQueries.length ?? 0,
    duplicateQueryCount: db?.duplicateQueries.length ?? 0,
  };
}

export function hasTimingData(input: TraceObservabilityInput): boolean {
  const resolved = resolveTimelineStages({
    ...(input.timingAudit ? { timingAudit: input.timingAudit } : {}),
    ...(input.stages ? { legacyStages: input.stages } : {}),
  });
  return resolved.stages.length > 0;
}

export function hasLlmData(input: TraceObservabilityInput): boolean {
  return (input.llmCallAudit?.calls.length ?? 0) > 0;
}

export function hasDbData(input: TraceObservabilityInput): boolean {
  return (input.dbObservability?.totalQueries ?? 0) > 0;
}

export function formatCostUsd(cost: number): string {
  if (cost === 0) return "$0";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatTimingSummary(ms: number | undefined, source: ObservabilitySummary["timingSource"]): string {
  if (ms == null) return "—";
  const formatted = formatDurationMs(ms);
  return source === "hrtime" ? `${formatted}ms (hrtime)` : `${formatted}ms`;
}

export function observabilityTraceHref(traceId: string): string {
  return `/retrieval-traces/${traceId}?view=observability`;
}

export function parseObservabilitySubview(
  view: string | null,
): ObservabilitySubview | undefined {
  if (view === "timing" || view === "llm" || view === "db" || view === "observability") {
    return view === "observability" ? undefined : view;
  }
  return undefined;
}
