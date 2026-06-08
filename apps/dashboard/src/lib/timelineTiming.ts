import type { ExecutionTimingAudit } from "@memory-middleware/shared-types";
import type { StageRecord } from "../components/observability/RetrievalTimeline.js";

export type TimelineSource = "hrtime" | "legacy";

export interface ResolvedTimeline {
  source: TimelineSource;
  stages: StageRecord[];
  totalLatencyMs?: number;
}

/** Format hrtime-derived milliseconds with up to 3 decimal places; trim trailing zeros. */
export function formatDurationMs(ms: number): string {
  const normalized = Math.round(ms * 1000) / 1000;
  const formatted = normalized.toFixed(3);
  return formatted.replace(/\.?0+$/, "") || "0";
}

/** Split colon-delimited stage names into primary label and optional hierarchy suffix. */
export function formatTimingStageLabel(stage: string): { primary: string; sub?: string } {
  const colonIndex = stage.indexOf(":");
  if (colonIndex === -1) {
    return { primary: formatStageToken(stage) };
  }

  const base = stage.slice(0, colonIndex);
  const suffix = stage.slice(colonIndex + 1);
  return {
    primary: formatStageToken(base),
    sub: /[\s/]/.test(suffix) ? suffix : formatStageToken(suffix),
  };
}

function formatStageToken(token: string): string {
  return token
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function timingAuditToStageRecords(audit: ExecutionTimingAudit): StageRecord[] {
  return audit.stages.map((stage) => ({
    stage: stage.stage,
    status: "completed",
    startedAt: stage.startTime,
    completedAt: stage.endTime,
    latencyMs: stage.durationMs,
  }));
}

export function resolveTimelineStages(input: {
  timingAudit?: ExecutionTimingAudit;
  legacyStages?: StageRecord[];
  legacyTotalLatencyMs?: number;
}): ResolvedTimeline {
  if (input.timingAudit?.stages?.length) {
    return {
      source: "hrtime",
      totalLatencyMs: input.timingAudit.totalLatency,
      stages: timingAuditToStageRecords(input.timingAudit),
    };
  }

  return {
    source: "legacy",
    stages: input.legacyStages ?? [],
    ...(input.legacyTotalLatencyMs != null
      ? { totalLatencyMs: input.legacyTotalLatencyMs }
      : {}),
  };
}
