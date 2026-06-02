import { similarityThresholdForMode } from "@memory-middleware/retrieval";
import type {
  PlanningRetrievalMode,
  PlanningRuntimeConfig,
  RetrievalModeDefinition,
} from "@memory-middleware/shared-types";
import { DEFAULT_PLANNING_RUNTIME_CONFIG } from "@memory-middleware/shared-types";

export function getModeDefinition(
  mode: PlanningRetrievalMode,
  config: PlanningRuntimeConfig = DEFAULT_PLANNING_RUNTIME_CONFIG,
): RetrievalModeDefinition {
  return config.modes[mode];
}

export function listRetrievalModes(
  config: PlanningRuntimeConfig = DEFAULT_PLANNING_RUNTIME_CONFIG,
): RetrievalModeDefinition[] {
  return Object.values(config.modes);
}

export function getModeImpacts(mode: PlanningRetrievalMode): string[] {
  const def = getModeDefinition(mode);
  return [
    `Top-K multiplier: ${def.topKMultiplier}x`,
    `Similarity threshold delta: ${def.similarityThresholdDelta}`,
    `Weighting profile: operational=${def.weightingProfile.operational}, recency=${def.weightingProfile.recency}, semanticDensity=${def.weightingProfile.semanticDensity}, reinforcement=${def.weightingProfile.reinforcement}`,
    def.breadthDescription,
    def.precisionProtection,
  ];
}

export function topKForPlanningMode(
  mode: PlanningRetrievalMode,
  baseTopK: number,
): number {
  const multipliers: Record<PlanningRetrievalMode, number> = {
    precision: 1,
    expanded: 2,
    exploratory: 1.75,
    "incident-response": 1.25,
  };
  return Math.round(baseTopK * (multipliers[mode] ?? 1));
}

export function similarityThresholdForPlanningMode(
  mode: PlanningRetrievalMode,
  baseThreshold: number,
): number {
  return similarityThresholdForMode(mode, baseThreshold);
}
