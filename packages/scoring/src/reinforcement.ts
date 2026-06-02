import type { EvolutionConfig, MemoryEvolution } from "@memory-middleware/shared-types";
import { DEFAULT_EVOLUTION_CONFIG } from "@memory-middleware/shared-types";

export interface ReinforcementInput {
  current: MemoryEvolution;
  contextualUsefulness?: number;
  config?: EvolutionConfig;
}

export interface ReinforcementResult {
  evolution: MemoryEvolution;
  delta: number;
  reason: string;
}

/**
 * Deterministic reinforcement after successful retrieval or explicit reinforce call.
 */
export function applyReinforcement(input: ReinforcementInput): ReinforcementResult {
  const config = input.config ?? DEFAULT_EVOLUTION_CONFIG;
  const usefulness = Math.min(Math.max(input.contextualUsefulness ?? 1, 0), 1);
  const increment = config.reinforcementIncrement * usefulness;

  const previous = input.current.reinforcementScore;
  const next = Math.min(config.reinforcementMax, previous + increment);
  const now = new Date().toISOString();

  return {
    evolution: {
      ...input.current,
      reinforcementScore: Math.round(next * 1000) / 1000,
      retrievalFrequency: input.current.retrievalFrequency + 1,
      lastReinforcedAt: now,
      lastRetrievedAt: now,
      recencyScore: 1,
      archivalScore: Math.max(0, input.current.archivalScore - increment * 0.5),
      archivalEligible: false,
    },
    delta: Math.round((next - previous) * 1000) / 1000,
    reason: `reinforcement +${increment.toFixed(3)} from retrieval frequency and contextual usefulness`,
  };
}

/** Record retrieval without full reinforcement (lighter touch). */
export function recordRetrieval(current: MemoryEvolution): MemoryEvolution {
  const now = new Date().toISOString();
  return {
    ...current,
    retrievalFrequency: current.retrievalFrequency + 1,
    lastRetrievedAt: now,
    recencyScore: 1,
    archivalScore: Math.max(0, current.archivalScore - 0.02),
  };
}

export function createInitialEvolution(): MemoryEvolution {
  return {
    reinforcementScore: 0,
    recencyScore: 1,
    archivalScore: 0,
    retrievalFrequency: 0,
    archivalEligible: false,
  };
}
