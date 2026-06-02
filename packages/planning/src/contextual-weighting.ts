import type {
  PlanningRetrievalMode,
  QueryDecomposition,
  WeightingAdjustments,
} from "@memory-middleware/shared-types";
import { getModeDefinition } from "./retrieval-modes.js";

export interface WeightingInput {
  retrievalMode: PlanningRetrievalMode;
  decomposition: QueryDecomposition;
  expansionTerms: string[];
}

export interface WeightingOutput {
  weightingAdjustments: WeightingAdjustments;
  weightingReasons: string[];
}

/**
 * Deterministic contextual weighting — explainable multipliers per retrieval signal.
 * Precision integrity: adjustments are bounded and semantic similarity remains primary in retrieval ranking.
 */
export function computeContextualWeighting(input: WeightingInput): WeightingOutput {
  const modeProfile = getModeDefinition(input.retrievalMode);
  const adjustments: WeightingAdjustments = { ...modeProfile.weightingProfile };
  const reasons: string[] = [
    `Base weighting profile applied for "${input.retrievalMode}" mode.`,
    modeProfile.precisionProtection,
  ];

  if (input.decomposition.contextualPriorities.includes("recency priority")) {
    adjustments.recency = Math.min(adjustments.recency * 1.1, 1.5);
    reasons.push("Recency weighting increased due to recency priority signal in query.");
  }

  if (input.decomposition.contextualPriorities.includes("operational urgency")) {
    adjustments.operational = Math.min(adjustments.operational * 1.15, 1.5);
    reasons.push("Operational weighting increased due to urgency signal in query.");
  }

  if (input.decomposition.contextualPriorities.includes("importance priority")) {
    adjustments.reinforcement = Math.min(adjustments.reinforcement * 1.1, 1.5);
    reasons.push("Reinforcement weighting increased due to importance signal in query.");
  }

  if (input.decomposition.domains.includes("incident")) {
    adjustments.operational = Math.min(adjustments.operational * 1.1, 1.5);
    adjustments.recency = Math.min(adjustments.recency * 1.1, 1.5);
    reasons.push("Incident domain detected — operational and recency weighting boosted.");
  }

  if (input.expansionTerms.length > 5) {
    adjustments.semanticDensity = Math.min(adjustments.semanticDensity * 1.05, 1.5);
    reasons.push("Semantic density weighting slightly increased to prioritize information-dense matches.");
  }

  return {
    weightingAdjustments: {
      operational: roundWeight(adjustments.operational),
      recency: roundWeight(adjustments.recency),
      semanticDensity: roundWeight(adjustments.semanticDensity),
      reinforcement: roundWeight(adjustments.reinforcement),
    },
    weightingReasons: reasons,
  };
}

/** Apply plan weighting multipliers to retrieval runtime ranking weights. */
export function applyWeightingToRanking(
  baseWeights: { importance: number; recency: number; reinforcement: number; semanticDensity: number },
  planAdjustments: WeightingAdjustments,
): { importance: number; recency: number; reinforcement: number; semanticDensity: number } {
  return {
    importance: roundWeight(baseWeights.importance * planAdjustments.operational),
    recency: roundWeight(baseWeights.recency * planAdjustments.recency),
    reinforcement: roundWeight(baseWeights.reinforcement * planAdjustments.reinforcement),
    semanticDensity: roundWeight(baseWeights.semanticDensity * planAdjustments.semanticDensity),
  };
}

function roundWeight(value: number): number {
  return Math.round(value * 1000) / 1000;
}
