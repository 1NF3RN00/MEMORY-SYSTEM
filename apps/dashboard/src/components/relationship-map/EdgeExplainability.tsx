import { motion, AnimatePresence } from "framer-motion";
import type { RelationshipGraphEdge } from "./types.js";
import { RELATIONSHIP_COLORS } from "./constants.js";

interface EdgeExplainabilityProps {
  edge: RelationshipGraphEdge | null;
  position: { x: number; y: number } | null;
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
          {label}
        </span>
        <span className="font-metric text-[0.625rem] tabular-nums text-[var(--color-text-secondary)]">
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${Math.min(100, value * 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function EdgeExplainability({ edge, position }: EdgeExplainabilityProps) {
  if (!edge || !position) return null;

  const colors = RELATIONSHIP_COLORS[edge.relationshipType];

  return (
    <AnimatePresence>
      <motion.div
        key={edge.id}
        initial={{ opacity: 0, scale: 0.92, y: 4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.15 }}
        className="relmap-tooltip pointer-events-none fixed z-50 w-72"
        style={{
          left: position.x + 16,
          top: position.y - 8,
        }}
      >
        <div className="rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-0)] p-3 shadow-[0_8px_32px_rgba(0,0,0,0.6),0_0_24px_rgba(56,189,248,0.08)]">
          <header className="mb-3 flex items-start justify-between gap-2">
            <div>
              <span className="font-metric text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                REL.EXPLAIN
              </span>
              <p
                className="mt-0.5 text-xs font-semibold"
                style={{ color: colors.stroke }}
              >
                {colors.label}
              </p>
            </div>
            <div className="text-right">
              <span className="font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                Confidence
              </span>
              <p className="font-metric text-lg font-semibold tabular-nums text-[var(--color-accent)]">
                {(edge.confidence * 100).toFixed(1)}
              </p>
            </div>
          </header>

          <p className="mb-3 text-[0.6875rem] leading-relaxed text-[var(--color-text-tertiary)]">
            {edge.origin}
          </p>

          <div className="space-y-2.5">
            <MetricBar label="Weight" value={edge.weight} color={colors.stroke} />
            <MetricBar
              label="Metadata Overlap"
              value={edge.metadataOverlap}
              color="#fbbf24"
            />
            <MetricBar
              label="Semantic Overlap"
              value={edge.semanticOverlap}
              color="#a78bfa"
            />
            <MetricBar
              label="Retrieval Co-occurrence"
              value={edge.retrievalCoOccurrence}
              color="#38bdf8"
            />
          </div>

          <footer className="mt-3 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-2">
            <span className="font-metric text-[0.5625rem] text-[var(--color-text-muted)]">
              {edge.source.slice(0, 8)}… → {edge.target.slice(0, 8)}…
            </span>
            {edge.compressionTraceId && (
              <span className="font-metric text-[0.5625rem] text-[var(--color-text-tertiary)]">
                CMP:{edge.compressionTraceId.slice(0, 6)}…
              </span>
            )}
          </footer>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
