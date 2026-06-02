import type {
  ModeTuningEntry,
  ModeTuningMetrics,
  ModeTuningResult,
  PlanningRetrievalMode,
  PlanningRuntimeConfig,
  PollutionRisk,
  RetrievalModeDefinition,
  RetrievalPlan,
} from "@memory-middleware/shared-types";
import { DEFAULT_PLANNING_RUNTIME_CONFIG, newUlid } from "@memory-middleware/shared-types";
import { runPlanningPipelineSync } from "./pipeline.js";
import type { WorkspaceMetadataContext } from "./metadata-expansion.js";
import { getModeDefinition, listRetrievalModes } from "./retrieval-modes.js";

const ALL_MODES: PlanningRetrievalMode[] = [
  "precision",
  "expanded",
  "exploratory",
  "incident-response",
];

function round(value: number, digits = 4): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function weightingDeviation(plan: RetrievalPlan): number {
  const values = Object.values(plan.weightingAdjustments);
  const deviations = values.map((v) => Math.abs(v - 1));
  return round(deviations.reduce((a, b) => a + b, 0) / values.length);
}

export function computeModeMetrics(
  plan: RetrievalPlan,
  modeDef: RetrievalModeDefinition,
  precisionBaseline: RetrievalPlan,
  config: PlanningRuntimeConfig = DEFAULT_PLANNING_RUNTIME_CONFIG,
): ModeTuningMetrics {
  const maxExpansion = config.maxExpansionTerms;
  const expansionTermDelta = plan.expansionTerms.length - precisionBaseline.expansionTerms.length;
  const expansionRatio =
    plan.expansionTerms.length / Math.max(precisionBaseline.expansionTerms.length, 1);

  const expansionComponent = (plan.expansionTerms.length / maxExpansion) * 0.35;
  const thresholdComponent = Math.abs(modeDef.similarityThresholdDelta) * 6 * 0.25;
  const topKComponent = Math.max(0, modeDef.topKMultiplier - 1) * 0.12;
  const relationshipComponent =
    (plan.metadataExpansion.relationships.length / 10) * 0.1;
  const weightingComponent = weightingDeviation(plan) * 0.18;

  const pollutionScore = round(
    Math.min(
      1,
      expansionComponent +
        thresholdComponent +
        topKComponent +
        relationshipComponent +
        weightingComponent,
    ),
  );

  const precisionScore = round(
    Math.max(0, 1 - pollutionScore * 0.55 - Math.max(0, expansionRatio - 1) * 0.25),
  );

  const breadthScore = pollutionScore;

  let pollutionRisk: PollutionRisk = "low";
  if (pollutionScore >= 0.6) pollutionRisk = "elevated";
  else if (pollutionScore >= 0.35) pollutionRisk = "moderate";

  return {
    precisionScore,
    pollutionScore,
    pollutionRisk,
    breadthScore,
    expansionTermCount: plan.expansionTerms.length,
    expansionTermDeltaVsPrecision: expansionTermDelta,
    hintCount: plan.retrievalHints.length,
    weightingDeviation: weightingDeviation(plan),
  };
}

function isPrecisionIntegrityOk(
  metrics: ModeTuningMetrics,
  precisionBaselineMetrics: ModeTuningMetrics,
  config: PlanningRuntimeConfig,
): boolean {
  const maxPollution = config.maxPollutionScore ?? 0.65;
  const minRetention = config.minPrecisionRetention ?? 0.85;

  if (metrics.pollutionScore > maxPollution) return false;
  if (metrics.precisionScore < precisionBaselineMetrics.precisionScore * minRetention) {
    return false;
  }
  if (metrics.pollutionScore > precisionBaselineMetrics.pollutionScore * 1.45) return false;
  return true;
}

function recommendMode(
  entries: ModeTuningEntry[],
  precisionPlan: RetrievalPlan,
): { mode: PlanningRetrievalMode; reason: string } {
  const precisionEntry = entries.find((e) => e.mode === "precision");
  if (!precisionEntry) {
    return { mode: "precision", reason: "Precision baseline unavailable — defaulting to precision." };
  }

  const eligible = entries.filter(
    (e) => e.mode !== "precision" && e.precisionIntegrityOk,
  );

  if (eligible.length === 0) {
    return {
      mode: "precision",
      reason:
        "All alternate modes exceeded pollution or precision retention bounds — precision remains dominant.",
    };
  }

  const priorities = precisionPlan.decomposition.contextualPriorities;
  const domains = precisionPlan.decomposition.domains;

  if (
    priorities.includes("operational urgency") ||
    domains.includes("incident")
  ) {
    const incident = eligible.find((e) => e.mode === "incident-response");
    if (incident) {
      return {
        mode: "incident-response",
        reason:
          "Operational urgency or incident domain detected with pollution within bounds — incident-response selected.",
      };
    }
  }

  if (precisionPlan.metadataExpansion.relationships.length > 0) {
    const exploratory = eligible.find((e) => e.mode === "exploratory");
    if (exploratory) {
      return {
        mode: "exploratory",
        reason:
          "Relationship-assisted expansion available with pollution controlled — exploratory selected.",
      };
    }
  }

  if (domains.length >= 2) {
    const expanded = eligible.find((e) => e.mode === "expanded");
    if (expanded) {
      return {
        mode: "expanded",
        reason:
          "Multiple operational domains detected with pollution within bounds — expanded selected for breadth.",
      };
    }
  }

  const bestEligible = eligible.sort(
    (a, b) => b.metrics.precisionScore - a.metrics.precisionScore,
  )[0];

  if (bestEligible && bestEligible.metrics.precisionScore > precisionEntry.metrics.precisionScore) {
    return {
      mode: bestEligible.mode,
      reason: `${bestEligible.mode} improves precision score while maintaining pollution control.`,
    };
  }

  return {
    mode: "precision",
    reason: "Precision mode delivers the best precision-to-pollution ratio for this query.",
  };
}

export interface TuneRetrievalModesInput {
  workspaceId: string;
  query: string;
  workspaceContext?: WorkspaceMetadataContext;
  config?: PlanningRuntimeConfig;
}

/** Compare all retrieval modes for a query and recommend a mode with precision protection. */
export function tuneRetrievalModes(input: TuneRetrievalModesInput): ModeTuningResult {
  const config = input.config ?? DEFAULT_PLANNING_RUNTIME_CONFIG;
  const modeDefs = listRetrievalModes(config);

  const plans = ALL_MODES.map((mode) =>
    runPlanningPipelineSync({
      request: {
        workspaceId: input.workspaceId,
        query: input.query,
        retrievalMode: mode,
      },
      ...(input.workspaceContext ? { workspaceContext: input.workspaceContext } : {}),
      config,
    }).plan,
  );

  const precisionPlan = plans.find((p) => p.retrievalMode === "precision")!;
  const precisionModeDef = getModeDefinition("precision", config);
  const precisionMetrics = computeModeMetrics(precisionPlan, precisionModeDef, precisionPlan, config);

  const entries: ModeTuningEntry[] = plans.map((plan) => {
    const modeDef = modeDefs.find((m) => m.mode === plan.retrievalMode)!;
    const metrics = computeModeMetrics(plan, modeDef, precisionPlan, config);
    return {
      mode: plan.retrievalMode,
      plan,
      metrics,
      precisionIntegrityOk: isPrecisionIntegrityOk(metrics, precisionMetrics, config),
    };
  });

  const recommendation = recommendMode(entries, precisionPlan);
  const nonPrecisionOk = entries
    .filter((e) => e.mode !== "precision")
    .every((e) => !e.precisionIntegrityOk || e.metrics.pollutionRisk !== "elevated");

  return {
    tuningId: newUlid(),
    workspaceId: input.workspaceId,
    query: input.query,
    recommendedMode: recommendation.mode,
    recommendationReason: recommendation.reason,
    precisionBaselineMode: "precision",
    entries,
    precisionIntegrityProtected: nonPrecisionOk,
    generatedAt: new Date().toISOString(),
  };
}
