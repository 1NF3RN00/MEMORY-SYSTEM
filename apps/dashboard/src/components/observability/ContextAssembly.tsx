import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";

interface ContextMemory {
  memoryId: string;
  title: string;
  memoryType: string;
  memoryScore: number;
  chunks: Array<{ chunkId: string; chunkIndex: number; tokenCount: number; finalScore: number }>;
}

interface TokenBudget {
  maxTokens: number;
  usedTokens: number;
  trimmedTokens: number;
}

interface ContextAssemblyProps {
  memories: ContextMemory[];
  tokenBudget: TokenBudget;
  retrievedCount: number;
  deduplicatedCount: number;
  finalCount: number;
  className?: string;
}

export function ContextAssembly({
  memories,
  tokenBudget,
  retrievedCount,
  deduplicatedCount,
  finalCount,
  className,
}: ContextAssemblyProps) {
  const utilizationPct = (tokenBudget.usedTokens / tokenBudget.maxTokens) * 100;

  return (
    <div className={cn("space-y-5", className)}>
      {/* Pipeline funnel */}
      <div className="flex items-center gap-2">
        <FunnelStep label="Retrieved" count={retrievedCount} />
        <FunnelArrow />
        <FunnelStep label="Deduped" count={deduplicatedCount} />
        <FunnelArrow />
        <FunnelStep label="Final" count={finalCount} accent />
      </div>

      {/* Token budget bar */}
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <span className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-tertiary)]">
            Token Budget
          </span>
          <span className="font-metric text-xs tabular-nums text-[var(--color-text-secondary)]">
            {tokenBudget.usedTokens.toLocaleString()} / {tokenBudget.maxTokens.toLocaleString()}
          </span>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(utilizationPct, 100)}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--color-accent)]"
          />
          {tokenBudget.trimmedTokens > 0 && (
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${(tokenBudget.trimmedTokens / tokenBudget.maxTokens) * 100}%`,
              }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-y-0 rounded-full bg-[var(--color-warning)] opacity-40"
              style={{ left: `${utilizationPct}%` }}
            />
          )}
        </div>
        {tokenBudget.trimmedTokens > 0 && (
          <p className="mt-1.5 font-metric text-[0.625rem] text-[var(--color-text-muted)]">
            {tokenBudget.trimmedTokens.toLocaleString()} tokens trimmed
          </p>
        )}
      </div>

      {/* Memory assembly blocks */}
      <div className="space-y-2">
        {memories.map((memory, i) => (
          <motion.div
            key={memory.memoryId}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className="group rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/50 p-3 transition-colors hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-2)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  to={`/memory/${memory.memoryId}`}
                  className="text-sm font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] no-underline"
                >
                  {memory.title || memory.memoryId.slice(0, 12)}
                </Link>
                <p className="mt-0.5 font-metric text-[0.625rem] text-[var(--color-text-muted)]">
                  {memory.memoryType} · {memory.chunks.length} chunk{memory.chunks.length !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="font-metric text-xs font-medium tabular-nums text-[var(--color-accent)]">
                {memory.memoryScore.toFixed(3)}
              </span>
            </div>

            {/* Chunk tokens visualization */}
            <div className="mt-2 flex gap-0.5">
              {memory.chunks.map((chunk) => {
                const widthPct = Math.max(8, (chunk.tokenCount / tokenBudget.maxTokens) * 100);
                return (
                  <div
                    key={chunk.chunkId}
                    className="group/chunk relative h-5 rounded-sm bg-[var(--color-accent-muted)] transition-colors hover:bg-[var(--color-accent-soft)]"
                    style={{ width: `${widthPct}%`, minWidth: "12px" }}
                    title={`#${chunk.chunkIndex} · ${chunk.tokenCount} tokens · score ${chunk.finalScore.toFixed(3)}`}
                  >
                    <span className="absolute inset-0 flex items-center justify-center font-metric text-[0.5rem] text-[var(--color-text-muted)] opacity-0 group-hover/chunk:opacity-100">
                      {chunk.tokenCount}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function FunnelStep({ label, count, accent }: { label: string; count: number; accent?: boolean }) {
  return (
    <div className="flex-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 py-2 text-center">
      <span className="block font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "mt-0.5 block font-metric text-base font-semibold tabular-nums",
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]",
        )}
      >
        {count}
      </span>
    </div>
  );
}

function FunnelArrow() {
  return (
    <svg className="h-3 w-3 shrink-0 text-[var(--color-text-muted)]" viewBox="0 0 12 12" fill="none">
      <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function TokenBudgetVisualizer({
  maxTokens,
  usedTokens,
  trimmedTokens,
  className,
}: TokenBudget & { className?: string }) {
  const segments = [
    { label: "Used", value: usedTokens, color: "bg-[var(--color-accent)]" },
    { label: "Trimmed", value: trimmedTokens, color: "bg-[var(--color-warning)] opacity-50" },
    { label: "Available", value: Math.max(0, maxTokens - usedTokens - trimmedTokens), color: "bg-[var(--color-surface-3)]" },
  ];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex h-3 overflow-hidden rounded-full">
        {segments.map((seg) => (
          <motion.div
            key={seg.label}
            initial={{ flex: 0 }}
            animate={{ flex: seg.value }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={cn("first:rounded-l-full last:rounded-r-full", seg.color)}
          />
        ))}
      </div>
      <div className="flex gap-4">
        {segments.map((seg) => (
          <div key={seg.label} className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-sm", seg.color.split(" ")[0])} />
            <span className="font-metric text-[0.625rem] text-[var(--color-text-tertiary)]">
              {seg.label}
            </span>
            <span className="font-metric text-[0.625rem] tabular-nums text-[var(--color-text-secondary)]">
              {seg.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
