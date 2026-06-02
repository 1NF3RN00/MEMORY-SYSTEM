import { motion } from "framer-motion";
import { Badge, statusToBadge } from "../ui/Badge.js";
import { cn } from "../../lib/cn.js";

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
  stages: StageRecord[];
  totalLatencyMs?: number;
  className?: string;
}

export function RetrievalTimeline({ stages, totalLatencyMs, className }: RetrievalTimelineProps) {
  const maxLatency = Math.max(...stages.map((s) => s.latencyMs ?? 0), 1);

  return (
    <div className={cn("space-y-4", className)}>
      {totalLatencyMs != null && (
        <div className="flex items-baseline justify-between">
          <span className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
            Total Pipeline Latency
          </span>
          <span className="font-metric text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
            {totalLatencyMs}
            <span className="ml-0.5 text-sm font-normal text-[var(--color-text-tertiary)]">ms</span>
          </span>
        </div>
      )}

      <div className="relative space-y-0">
        {stages.map((stage, i) => (
          <TimelineStage
            key={`${stage.stage}-${i}`}
            stage={stage}
            index={i}
            isLast={i === stages.length - 1}
            maxLatency={maxLatency}
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
}: {
  stage: StageRecord;
  index: number;
  isLast: boolean;
  maxLatency: number;
}) {
  const latencyPct = stage.latencyMs ? (stage.latencyMs / maxLatency) * 100 : 0;

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
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--color-text-primary)]">
              {formatStageName(stage.stage)}
            </span>
            <Badge variant={statusToBadge(stage.status)}>{stage.status}</Badge>
          </div>
          {stage.latencyMs != null && (
            <span className="font-metric text-xs tabular-nums text-[var(--color-text-tertiary)]">
              {stage.latencyMs}ms
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
