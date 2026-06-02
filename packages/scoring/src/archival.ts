import type { EvolutionConfig, MemoryEvolution } from "@memory-middleware/shared-types";
import { DEFAULT_EVOLUTION_CONFIG } from "@memory-middleware/shared-types";

export interface ArchivalEvaluation {
  evolution: MemoryEvolution;
  shouldArchive: boolean;
  reason: string;
  threshold: number;
}

/**
 * Evaluate archival eligibility deterministically.
 * Does NOT mutate source truth — only marks eligibility.
 */
export function evaluateArchivalEligibility(
  current: MemoryEvolution,
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): ArchivalEvaluation {
  const lowRecency = current.recencyScore < 0.2;
  const lowRetrieval = current.retrievalFrequency < config.archivalMinRetrievalFrequency;
  const highArchivalScore = current.archivalScore >= config.archivalThreshold;

  const eligible = highArchivalScore || (lowRecency && lowRetrieval && current.archivalScore >= 0.5);

  let reason = "memory remains operationally active";
  if (eligible) {
    if (highArchivalScore) {
      reason = `archival score ${current.archivalScore.toFixed(2)} exceeds threshold ${config.archivalThreshold}`;
    } else {
      reason = "stale memory with low retrieval frequency and elevated archival score";
    }
  }

  return {
    evolution: {
      ...current,
      archivalEligible: eligible,
      ...(eligible ? { archivalReason: reason } : {}),
    },
    shouldArchive: eligible,
    reason,
    threshold: config.archivalThreshold,
  };
}

/** Transition to archived state (replay-safe — preserves lineage). */
export function transitionToArchived(
  current: MemoryEvolution,
  reason: string,
): MemoryEvolution {
  return {
    ...current,
    archivalEligible: true,
    archivalScore: 1,
    archivalReason: reason,
    recencyScore: 0,
  };
}
