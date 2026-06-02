import type { EvolutionConfig, MemoryEvolution } from "@memory-middleware/shared-types";
import { DEFAULT_EVOLUTION_CONFIG } from "@memory-middleware/shared-types";

export interface RecencyDecayResult {
  evolution: MemoryEvolution;
  daysSinceLastRetrieval: number;
  formula: string;
  decayWeight: number;
}

/**
 * Deterministic exponential recency decay.
 * recencyScore = exp(-days / halfLife) * weight
 */
export function applyRecencyDecay(
  current: MemoryEvolution,
  referenceDate: Date = new Date(),
  config: EvolutionConfig = DEFAULT_EVOLUTION_CONFIG,
): RecencyDecayResult {
  const lastActivity = current.lastRetrievedAt ?? current.lastReinforcedAt;
  let daysSince = 0;

  if (lastActivity) {
    daysSince = Math.max(
      0,
      (referenceDate.getTime() - new Date(lastActivity).getTime()) / 86_400_000,
    );
  } else {
    daysSince = config.staleDaysThreshold;
  }

  const decayFactor = Math.exp(-daysSince / config.recencyHalfLifeDays);
  const recencyScore = Math.round(decayFactor * config.recencyWeight * 1000) / 1000;

  const formula = `exp(-${daysSince.toFixed(1)} / ${config.recencyHalfLifeDays}) * ${config.recencyWeight}`;

  const archivalIncrement = daysSince > config.staleDaysThreshold ? 0.05 : daysSince / config.staleDaysThreshold * 0.02;
  const archivalScore = Math.min(
    1,
    Math.round((current.archivalScore + archivalIncrement) * 1000) / 1000,
  );

  return {
    evolution: {
      ...current,
      recencyScore,
      archivalScore,
    },
    daysSinceLastRetrieval: Math.round(daysSince * 10) / 10,
    formula,
    decayWeight: config.recencyWeight,
  };
}

/** Compute recency boost for ranking (0–1 scale). */
export function recencyBoostFromEvolution(evolution: MemoryEvolution, weight: number): number {
  return evolution.recencyScore * weight;
}
