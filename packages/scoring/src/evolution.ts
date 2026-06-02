import type {
  CanonicalMemoryScoring,
  EvolutionConfig,
  EvolutionHistoryEntry,
  MemoryEvolution,
  MemoryEvolutionView,
} from "@memory-middleware/shared-types";
import { DEFAULT_EVOLUTION_CONFIG } from "@memory-middleware/shared-types";
import { evaluateArchivalEligibility, transitionToArchived } from "./archival.js";
import { applyRecencyDecay } from "./recency-decay.js";
import { applyReinforcement, createInitialEvolution, recordRetrieval } from "./reinforcement.js";

export interface EvolutionState {
  evolution: MemoryEvolution;
  history: EvolutionHistoryEntry[];
}

export function evolutionFromScoring(
  scoring: CanonicalMemoryScoring,
  metadata?: Record<string, unknown>,
): MemoryEvolution {
  const stored = metadata?.evolution as MemoryEvolution | undefined;
  if (stored) return stored;

  return {
    reinforcementScore: scoring.reinforcementScore,
    recencyScore: 1,
    archivalScore: scoring.archivalScore,
    retrievalFrequency: scoring.retrievalCount,
    archivalEligible: scoring.archivalScore >= DEFAULT_EVOLUTION_CONFIG.archivalThreshold,
  };
}

export function scoringFromEvolution(
  current: CanonicalMemoryScoring,
  evolution: MemoryEvolution,
): CanonicalMemoryScoring {
  return {
    ...current,
    reinforcementScore: evolution.reinforcementScore,
    retrievalCount: evolution.retrievalFrequency,
    archivalScore: evolution.archivalScore,
  };
}

function pushHistory(
  history: EvolutionHistoryEntry[],
  event: string,
  previous: Partial<MemoryEvolution>,
  next: Partial<MemoryEvolution>,
  reason: string,
): EvolutionHistoryEntry[] {
  return [
    ...history,
    {
      timestamp: new Date().toISOString(),
      event,
      previousValues: previous,
      newValues: next,
      reason,
    },
  ];
}

export function reinforceMemory(
  state: EvolutionState,
  contextualUsefulness?: number,
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): { state: EvolutionState; delta: number; reason: string } {
  const result = applyReinforcement({
    current: state.evolution,
    ...(contextualUsefulness !== undefined ? { contextualUsefulness } : {}),
    config,
  });

  const decayed = applyRecencyDecay(result.evolution, new Date(), config);
  const archival = evaluateArchivalEligibility(decayed.evolution, config);

  return {
    state: {
      evolution: archival.evolution,
      history: pushHistory(
        state.history,
        "reinforcement_updated",
        { reinforcementScore: state.evolution.reinforcementScore },
        { reinforcementScore: result.evolution.reinforcementScore },
        result.reason,
      ),
    },
    delta: result.delta,
    reason: result.reason,
  };
}

export function updateDecay(
  state: EvolutionState,
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): EvolutionState {
  const decay = applyRecencyDecay(state.evolution, new Date(), config);
  const archival = evaluateArchivalEligibility(decay.evolution, config);

  return {
    evolution: archival.evolution,
    history: pushHistory(
      state.history,
      "decay_updated",
      { recencyScore: state.evolution.recencyScore, archivalScore: state.evolution.archivalScore },
      { recencyScore: decay.evolution.recencyScore, archivalScore: decay.evolution.archivalScore },
      decay.formula,
    ),
  };
}

export function onRetrieval(
  state: EvolutionState,
  reinforce = false,
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): EvolutionState {
  if (reinforce) {
    return reinforceMemory(state, 1, config).state;
  }

  const updated = recordRetrieval(state.evolution);
  const decay = applyRecencyDecay(updated, new Date(), config);

  return {
    evolution: decay.evolution,
    history: pushHistory(
      state.history,
      "retrieval_recorded",
      { retrievalFrequency: state.evolution.retrievalFrequency },
      { retrievalFrequency: updated.retrievalFrequency },
      "retrieval frequency incremented",
    ),
  };
}

export function prepareArchive(
  state: EvolutionState,
  reason: string,
): EvolutionState {
  const archived = transitionToArchived(state.evolution, reason);
  return {
    evolution: archived,
    history: pushHistory(
      state.history,
      "archival_transitioned",
      { archivalEligible: state.evolution.archivalEligible },
      { archivalEligible: true, archivalScore: 1 },
      reason,
    ),
  };
}

export function buildEvolutionView(
  memoryId: string,
  scoring: CanonicalMemoryScoring,
  state: EvolutionState,
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): MemoryEvolutionView {
  const decay = applyRecencyDecay(state.evolution, new Date(), config);
  const archival = evaluateArchivalEligibility(decay.evolution, config);

  return {
    memoryId,
    evolution: archival.evolution,
    scoring,
    history: state.history,
    decayExplanation: {
      recencyScore: decay.evolution.recencyScore,
      daysSinceLastRetrieval: decay.daysSinceLastRetrieval,
      decayWeight: decay.decayWeight,
      formula: decay.formula,
    },
    archivalExplanation: {
      archivalEligible: archival.evolution.archivalEligible,
      archivalScore: archival.evolution.archivalScore,
      threshold: archival.threshold,
      reason: archival.reason,
    },
  };
}

export {
  applyReinforcement,
  applyRecencyDecay,
  evaluateArchivalEligibility,
  createInitialEvolution,
  recordRetrieval,
  transitionToArchived,
};
