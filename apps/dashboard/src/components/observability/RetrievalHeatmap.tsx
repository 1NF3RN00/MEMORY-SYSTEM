import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";

interface HeatmapEntry {
  memoryId: string;
  accessCount: number;
  averageRank: number;
  averageScore: number;
}

interface RetrievalHeatmapProps {
  entries: HeatmapEntry[];
  maxEntries?: number;
  className?: string;
}

export function RetrievalHeatmap({ entries, maxEntries = 20, className }: RetrievalHeatmapProps) {
  const sorted = [...entries]
    .sort((a, b) => b.accessCount - a.accessCount)
    .slice(0, maxEntries);

  const maxAccess = Math.max(...sorted.map((e) => e.accessCount), 1);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-[var(--color-text-tertiary)]">
        No retrieval history yet.
      </p>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      {sorted.map((entry, i) => (
        <HeatmapRow key={entry.memoryId} entry={entry} index={i} maxAccess={maxAccess} />
      ))}
    </div>
  );
}

function HeatmapRow({
  entry,
  index,
  maxAccess,
}: {
  entry: HeatmapEntry;
  index: number;
  maxAccess: number;
}) {
  const intensity = entry.accessCount / maxAccess;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className="group flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-[var(--color-surface-2)]"
    >
      <Link
        to={`/memory/${entry.memoryId}`}
        className="w-24 shrink-0 truncate font-metric text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] no-underline"
      >
        {entry.memoryId.slice(0, 10)}…
      </Link>

      <div className="relative flex-1 h-4 overflow-hidden rounded-sm bg-[var(--color-surface-3)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${intensity * 100}%` }}
          transition={{ delay: index * 0.03 + 0.1, duration: 0.4 }}
          className="absolute inset-y-0 left-0 rounded-sm"
          style={{
            background: `rgba(56, 189, 248, ${0.15 + intensity * 0.55})`,
          }}
        />
        <span className="absolute inset-0 flex items-center px-2 font-metric text-[0.5625rem] tabular-nums text-[var(--color-text-secondary)]">
          {entry.accessCount}
        </span>
      </div>

      <span className="w-10 shrink-0 text-right font-metric text-[0.625rem] tabular-nums text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
        #{entry.averageRank.toFixed(1)}
      </span>

      <span className="w-12 shrink-0 text-right font-metric text-[0.625rem] tabular-nums text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">
        {entry.averageScore.toFixed(2)}
      </span>
    </motion.div>
  );
}

interface CompressionAnalyticsProps {
  originalTokens: number;
  compressedTokens: number;
  fidelityScore?: number;
  mergeCount?: number;
  trimCount?: number;
  className?: string;
}

export function CompressionAnalytics({
  originalTokens,
  compressedTokens,
  fidelityScore,
  mergeCount,
  trimCount,
  className,
}: CompressionAnalyticsProps) {
  const ratio = originalTokens > 0 ? compressedTokens / originalTokens : 0;
  const saved = originalTokens - compressedTokens;

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      <AnalyticsCell label="Original" value={originalTokens.toLocaleString()} unit="tokens" />
      <AnalyticsCell label="Compressed" value={compressedTokens.toLocaleString()} unit="tokens" accent />
      <AnalyticsCell label="Ratio" value={ratio.toFixed(2)} unit="×" />
      <AnalyticsCell label="Saved" value={saved.toLocaleString()} unit="tokens" />
      {fidelityScore != null && (
        <AnalyticsCell label="Fidelity" value={fidelityScore.toFixed(3)} unit="" accent />
      )}
      {mergeCount != null && (
        <AnalyticsCell label="Merges" value={String(mergeCount)} unit="" />
      )}
      {trimCount != null && (
        <AnalyticsCell label="Trims" value={String(trimCount)} unit="" />
      )}
    </div>
  );
}

function AnalyticsCell({
  label,
  value,
  unit,
  accent,
}: {
  label: string;
  value: string;
  unit: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)]/50 px-3 py-2.5">
      <span className="block font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "mt-0.5 block font-metric text-base font-semibold tabular-nums",
          accent ? "text-[var(--color-accent)]" : "text-[var(--color-text-primary)]",
        )}
      >
        {value}
        {unit && (
          <span className="ml-1 text-xs font-normal text-[var(--color-text-tertiary)]">{unit}</span>
        )}
      </span>
    </div>
  );
}

interface MemoryLineageNode {
  id: string;
  label: string;
  type: "memory" | "chunk" | "source" | "ingestion";
  children?: MemoryLineageNode[];
}

interface MemoryLineageGraphProps {
  root: MemoryLineageNode;
  className?: string;
}

export function MemoryLineageGraph({ root, className }: MemoryLineageGraphProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <LineageNode node={root} depth={0} />
    </div>
  );
}

function LineageNode({ node, depth }: { node: MemoryLineageNode; depth: number }) {
  const typeColors: Record<string, string> = {
    memory: "border-[var(--color-accent)]/30 text-[var(--color-accent)]",
    chunk: "border-[var(--color-border-default)] text-[var(--color-text-secondary)]",
    source: "border-[var(--color-border-default)] text-[var(--color-text-tertiary)]",
    ingestion: "border-[rgba(74,222,128,0.2)] text-[var(--color-success)]",
  };

  return (
    <div style={{ paddingLeft: depth * 16 }}>
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs",
          "bg-[var(--color-surface-2)]/50 transition-colors hover:bg-[var(--color-surface-2)]",
          typeColors[node.type] ?? typeColors.chunk,
        )}
      >
        <span className="font-metric text-[0.5625rem] uppercase tracking-[0.04em] opacity-60">
          {node.type}
        </span>
        <span className="font-medium">{node.label}</span>
      </div>
      {node.children?.map((child) => (
        <div key={child.id} className="relative mt-1">
          <div className="absolute left-2 top-0 h-full w-px bg-[var(--color-border-subtle)]" />
          <LineageNode node={child} depth={depth + 1} />
        </div>
      ))}
    </div>
  );
}
