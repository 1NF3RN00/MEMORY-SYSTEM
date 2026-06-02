import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { cn } from "../../lib/cn.js";

export interface RankingRow {
  memoryId: string;
  chunkId: string;
  semanticSimilarity: number;
  importanceBoost: number;
  recencyBoost: number;
  reinforcementBoost: number;
  semanticDensityBoost: number;
  finalScore: number;
  rankingRank: number;
}

export interface RejectedRow {
  memoryId: string;
  chunkId: string;
  reason: string;
  detail: string;
  semanticSimilarity?: number;
  finalScore?: number;
}

interface ExplainabilityPanelProps {
  rankingBreakdown: RankingRow[];
  rejectedCandidates: RejectedRow[];
  className?: string;
}

const scoreDimensions = [
  { key: "semanticSimilarity" as const, label: "Semantic", color: "bg-[var(--color-accent)]" },
  { key: "importanceBoost" as const, label: "Importance", color: "bg-[var(--color-success)]" },
  { key: "recencyBoost" as const, label: "Recency", color: "bg-[var(--color-warning)]" },
  { key: "reinforcementBoost" as const, label: "Reinforcement", color: "bg-purple-400" },
  { key: "semanticDensityBoost" as const, label: "Density", color: "bg-[var(--color-text-tertiary)]" },
];

export function ExplainabilityPanel({
  rankingBreakdown,
  rejectedCandidates,
  className,
}: ExplainabilityPanelProps) {
  return (
    <div className={cn("space-y-6", className)}>
      <section>
        <header className="mb-3">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Ranking Forensics
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
            Deterministic score decomposition per candidate
          </p>
        </header>

        <div className="space-y-2">
          {rankingBreakdown.map((row, i) => (
            <RankingCard key={row.chunkId} row={row} index={i} />
          ))}
        </div>
      </section>

      {rejectedCandidates.length > 0 && (
        <section>
          <header className="mb-3">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Rejected Candidates
            </h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-tertiary)]">
              {rejectedCandidates.length} exclusion{rejectedCandidates.length !== 1 ? "s" : ""} with reason codes
            </p>
          </header>

          <div className="space-y-1.5">
            {rejectedCandidates.map((row, i) => (
              <RejectedCard key={`${row.chunkId}-${i}`} row={row} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RankingCard({ row, index }: { row: RankingRow; index: number }) {
  const maxScore = Math.max(...scoreDimensions.map((d) => row[d.key]), 0.001);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.2 }}
      className="group rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-3 transition-colors hover:border-[var(--color-border-default)]"
    >
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded font-metric text-[0.625rem] font-medium text-[var(--color-text-tertiary)] bg-[var(--color-surface-3)]">
            {row.rankingRank}
          </span>
          <Link
            to={`/memory/${row.memoryId}`}
            className="truncate font-metric text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-accent)] no-underline"
          >
            {row.chunkId.slice(0, 14)}…
          </Link>
        </div>
        <span className="font-metric text-sm font-semibold tabular-nums text-[var(--color-accent)]">
          {row.finalScore.toFixed(4)}
        </span>
      </div>

      {/* Score dimension bars */}
      <div className="grid grid-cols-5 gap-2">
        {scoreDimensions.map((dim) => {
          const value = row[dim.key];
          const pct = (value / maxScore) * 100;
          return (
            <div key={dim.key} className="group/dim">
              <div className="mb-1 flex items-center justify-between">
                <span className="font-metric text-[0.5625rem] uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
                  {dim.label}
                </span>
                <span className="font-metric text-[0.5625rem] tabular-nums text-[var(--color-text-tertiary)] opacity-0 group-hover/dim:opacity-100 transition-opacity">
                  {value.toFixed(3)}
                </span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ delay: index * 0.03 + 0.1, duration: 0.35 }}
                  className={cn("h-full rounded-full opacity-70", dim.color)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

function RejectedCard({ row }: { row: RejectedRow }) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-[rgba(248,113,113,0.1)] bg-[var(--color-danger-soft)]/30 px-3 py-2">
      <span className="mt-0.5 font-metric text-[0.625rem] font-medium uppercase tracking-[0.04em] text-[var(--color-danger)]">
        {row.reason}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-[var(--color-text-secondary)]">{row.detail}</p>
        {row.chunkId && (
          <p className="mt-0.5 font-metric text-[0.625rem] text-[var(--color-text-muted)]">
            {row.chunkId.slice(0, 14)}…
          </p>
        )}
      </div>
    </div>
  );
}

export function ReinforcementScoringPanel({
  rows,
  className,
}: {
  rows: RankingRow[];
  className?: string;
}) {
  const sorted = [...rows].sort((a, b) => b.reinforcementBoost - a.reinforcementBoost).slice(0, 8);
  const maxReinforcement = Math.max(...sorted.map((r) => r.reinforcementBoost), 0.001);

  return (
    <div className={cn("space-y-2", className)}>
      {sorted.map((row, i) => (
        <div key={row.chunkId} className="flex items-center gap-3">
          <span className="w-16 truncate font-metric text-[0.625rem] text-[var(--color-text-muted)]">
            {row.chunkId.slice(0, 8)}…
          </span>
          <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(row.reinforcementBoost / maxReinforcement) * 100}%` }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              className="h-full rounded-full bg-purple-400/70"
            />
          </div>
          <span className="w-12 text-right font-metric text-[0.625rem] tabular-nums text-[var(--color-text-tertiary)]">
            {row.reinforcementBoost.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
}
