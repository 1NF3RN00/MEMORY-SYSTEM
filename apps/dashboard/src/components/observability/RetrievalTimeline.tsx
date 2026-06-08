import { motion } from "framer-motion";
import type { ExecutionTimingAudit } from "@memory-middleware/shared-types";
import { Badge, statusToBadge } from "../ui/Badge.js";
import { cn } from "../../lib/cn.js";
import {
  formatDurationMs,
  formatTimingStageLabel,
  resolveTimelineStages,
} from "../../lib/timelineTiming.js";

export interface StageRecord {
  stage: string;
  status: string;
  startedAt?: string;
  completedAt?: string;
  latencyMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface RetrievalTimelineProps {
  stages?: StageRecord[];
  timingAudit?: ExecutionTimingAudit;
  totalLatencyMs?: number;
  className?: string;
}

export function RetrievalTimeline({
  stages,
  timingAudit,
  totalLatencyMs,
  className,
}: RetrievalTimelineProps) {
  const resolved = resolveTimelineStages({
    ...(timingAudit ? { timingAudit } : {}),
    ...(stages ? { legacyStages: stages } : {}),
    ...(totalLatencyMs != null ? { legacyTotalLatencyMs: totalLatencyMs } : {}),
  });

  const displayStages = resolved.stages;
  const maxLatency = Math.max(...displayStages.map((s) => s.latencyMs ?? 0), 1);

  return (
    <div className={cn("space-y-4", className)}>
      {resolved.totalLatencyMs != null && (
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
              Total Pipeline Latency
            </span>
            {resolved.source === "hrtime" && (
              <Badge variant="accent">hrtime</Badge>
            )}
          </div>
          <span className="font-metric text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
            {formatDurationMs(resolved.totalLatencyMs)}
            <span className="ml-0.5 text-sm font-normal text-[var(--color-text-tertiary)]">ms</span>
          </span>
        </div>
      )}

      <div className="relative space-y-0">
        {displayStages.map((stage, i) => (
          <TimelineStage
            key={`${stage.stage}-${i}`}
            stage={stage}
            index={i}
            isLast={i === displayStages.length - 1}
            maxLatency={maxLatency}
            useHrtimeFormatting={resolved.source === "hrtime"}
          />
        ))}
      </div>
    </div>
  );
}

function TimelineStage({
  stage,
  index,
  isLast,
  maxLatency,
  useHrtimeFormatting,
}: {
  stage: StageRecord;
  index: number;
  isLast: boolean;
  maxLatency: number;
  useHrtimeFormatting: boolean;
}) {
  const latencyPct = stage.latencyMs ? (stage.latencyMs / maxLatency) * 100 : 0;
  const stageLabel = useHrtimeFormatting
    ? formatTimingStageLabel(stage.stage)
    : { primary: formatStageName(stage.stage) };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05, duration: 0.25 }}
      className="relative flex gap-4 pb-4"
    >
      {/* Connector line */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
            stage.status === "completed"
              ? "border-[rgba(74,222,128,0.3)] bg-[var(--color-success-soft)]"
              : stage.status === "failed"
                ? "border-[rgba(248,113,113,0.3)] bg-[var(--color-danger-soft)]"
                : "border-[var(--color-border-default)] bg-[var(--color-surface-2)]",
          )}
        >
          <span className="font-metric text-[0.5625rem] text-[var(--color-text-tertiary)]">
            {index + 1}
          </span>
        </div>
        {!isLast && (
          <div className="mt-1 w-px flex-1 min-h-[24px] bg-[var(--color-border-default)]" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0">
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {stageLabel.primary}
              </span>
              {stageLabel.sub && (
                <span className="ml-1.5 font-metric text-[0.625rem] text-[var(--color-text-tertiary)]">
                  · {stageLabel.sub}
                </span>
              )}
            </div>
            <Badge variant={statusToBadge(stage.status)}>{stage.status}</Badge>
          </div>
          {stage.latencyMs != null && (
            <span className="font-metric text-xs tabular-nums text-[var(--color-text-tertiary)]">
              {useHrtimeFormatting ? formatDurationMs(stage.latencyMs) : stage.latencyMs}
              ms
            </span>
          )}
        </div>

        {/* Latency bar */}
        {stage.latencyMs != null && (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${latencyPct}%` }}
              transition={{ delay: index * 0.05 + 0.15, duration: 0.4 }}
              className="h-full rounded-full bg-[var(--color-accent)] opacity-60"
            />
          </div>
        )}

        {stage.error && (
          <p className="mt-1.5 text-xs text-[var(--color-danger)]">{stage.error}</p>
        )}
      </div>
    </motion.div>
  );
}

function formatStageName(stage: string): string {
  return stage
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
