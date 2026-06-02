import { motion } from "framer-motion";
import { staggerContainer, staggerItem } from "../../design-system/motion.js";
import { IntelligenceCard, MetricRow } from "./IntelligenceCard.js";
import type { IntelligencePanelData } from "./types.js";

interface OperationalIntelligencePanelsProps {
  data: IntelligencePanelData;
  loading?: boolean;
}

export function OperationalIntelligencePanels({ data, loading }: OperationalIntelligencePanelsProps) {
  const {
    activeContextWindow,
    retrievalConfidence,
    workspaceState,
    operationalHistorian,
    intelligenceDrift,
  } = data;

  return (
    <section className="flex h-full min-h-0 flex-col border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-0)]">
      <header className="shrink-0 border-b border-[var(--color-border-subtle)] px-4 py-3">
        <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-primary)]">
          Operational Intelligence
        </h2>
        <p className="mt-0.5 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
          Context assembly state
        </p>
      </header>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3"
      >
        {loading && data.workspaceState.activeMemories === 0 ? (
          <p className="px-1 text-[0.8125rem] text-[var(--color-text-secondary)]">Loading intelligence state…</p>
        ) : (
          <>
        <motion.div variants={staggerItem}>
          <IntelligenceCard label="Active Context Window" accent>
            <MetricRow
              label="Tokens assembled"
              value={activeContextWindow.tokensAssembled.toLocaleString()}
              mono
              highlight
            />
            <MetricRow
              label="Compression efficiency"
              value={`${Math.round(activeContextWindow.compressionEfficiency * 100)}%`}
              mono
            />
            <MetricRow
              label="Strategic memories"
              value={activeContextWindow.strategicMemoriesActive}
              mono
            />
          </IntelligenceCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <IntelligenceCard label="Retrieval Confidence">
            <MetricRow
              label="Contextual confidence"
              value={retrievalConfidence.contextualConfidence.toFixed(2)}
              mono
              highlight
            />
            <MetricRow
              label="Low-confidence retrievals"
              value={retrievalConfidence.lowConfidenceCount}
              mono
            />
          </IntelligenceCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <IntelligenceCard label="Workspace State">
            <MetricRow
              label="Active memories"
              value={workspaceState.activeMemories.toLocaleString()}
              mono
            />
            <MetricRow
              label="Transient research"
              value={workspaceState.transientResearchMemories}
              mono
            />
            <MetricRow
              label="Expiring contexts"
              value={workspaceState.expiringContexts}
              mono
            />
          </IntelligenceCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <IntelligenceCard label="Operational Historian">
            <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-2">
              <span className="block font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-tertiary)]">
                Most active scope
              </span>
              <span className="mt-1 block text-[0.8125rem] font-medium text-[var(--color-text-primary)]">
                {operationalHistorian.mostActiveScope}
              </span>
            </div>
          </IntelligenceCard>
        </motion.div>

        <motion.div variants={staggerItem}>
          <IntelligenceCard label="Intelligence Drift">
            <MetricRow
              label="Stale strategic memories"
              value={intelligenceDrift.staleStrategicMemories}
              mono
            />
            {intelligenceDrift.staleStrategicMemories > 0 && (
              <p className="font-metric text-[0.5625rem] text-[var(--color-warning)]">
                Review recommended
              </p>
            )}
          </IntelligenceCard>
        </motion.div>
          </>
        )}
      </motion.div>
    </section>
  );
}
