import type {
  BuildReportInput,
  RetrievalQualityMetrics,
} from "@memory-middleware/shared-types";
import { normalizeReportInput } from "./snapshot-normalize.js";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeRetrievalQualityMetrics(
  input: BuildReportInput,
): RetrievalQualityMetrics {
  const { snapshot } = normalizeReportInput(input);
  const pkg = snapshot.contextPackage;
  const chunkTraces = pkg.chunkTraces;
  const included = chunkTraces.filter((c) => c.tokenBudgetDecision === "included");
  const similarities = included.map((c) => c.semanticSimilarity);
  const scores = included.map((c) => c.finalScore);

  const retrievalPrecision = clamp01(mean(similarities));

  const totalCandidates =
    included.length + pkg.rejectedCandidates.length;
  const uniqueMemories = new Set(included.map((c) => c.memoryId)).size;
  const retrievalBreadth =
    totalCandidates > 0
      ? clamp01((uniqueMemories / Math.max(1, pkg.memories.length)) * (included.length / totalCandidates))
      : 0;

  const cohesionSpread = stddev(similarities);
  const semanticCohesion = clamp01(1 - cohesionSpread * 2);

  const usedTokens = Math.max(1, pkg.tokenBudget.usedTokens);
  const signalMass = scores.reduce((a, b) => a + b, 0);
  const contextualDensity =
    included.length > 0
      ? clamp01(signalMass / included.length / (usedTokens / 1000))
      : 0;

  let rankingStability = 1;
  if (input.rankingComparison) {
    const unstable = input.rankingComparison.rankingComparison.filter(
      (e) => e.rankDelta !== null && Math.abs(e.rankDelta) >= 3,
    );
    rankingStability = clamp01(1 - unstable.length / Math.max(1, included.length));
  } else if (scores.length >= 2) {
    const topSpread = Math.max(...scores) - Math.min(...scores.slice(0, Math.min(5, scores.length)));
    rankingStability = clamp01(1 - topSpread);
  }

  let relationshipUsefulness = 0.5;
  const aug = input.relationshipAugmentation;
  if (aug?.augmentationApplied && aug.neighborCount > 0) {
    const positive = aug.rankingImpacts.filter(
      (i) => i.augmentedScore > i.previousScore,
    ).length;
    relationshipUsefulness = clamp01(positive / aug.neighborCount);
  } else if (!aug?.augmentationApplied) {
    relationshipUsefulness = 0.75;
  }

  const trimmed = chunkTraces.filter((c) => c.tokenBudgetDecision === "trimmed").length;
  const deduped = chunkTraces.filter(
    (c) => c.deduplicationDecision === "removed_duplicate",
  ).length;
  const chunkQuality = clamp01(
    included.length / Math.max(1, included.length + trimmed + deduped),
  );

  const tokenEfficiency = clamp01(signalMass / usedTokens);

  let compressionIntegrity = 1;
  const artifact = snapshot.compressionArtifacts[0];
  if (artifact?.fidelityReport) {
    compressionIntegrity = clamp01(artifact.fidelityReport.fidelityScore);
  }

  let renderingQuality = 0.7;
  const delivery = snapshot.deliveryArtifacts[0];
  if (delivery?.renderingDecisions) {
    const rd = delivery.renderingDecisions;
    const optimization = rd.deliveryOptimization;
    const hierarchy = rd.hierarchy;
    if (optimization && hierarchy) {
      renderingQuality = clamp01(
        (optimization.readabilityScore +
          optimization.tokenDensityScore +
          (hierarchy.hierarchyDepth > 0 ? 0.85 : 0.5)) /
          2.5,
      );
    }
  }

  return {
    retrievalPrecision,
    retrievalBreadth,
    semanticCohesion,
    contextualDensity,
    rankingStability,
    relationshipUsefulness,
    chunkQuality,
    tokenEfficiency,
    compressionIntegrity,
    renderingQuality,
  };
}

export function computeMetricDeltas(
  before: RetrievalQualityMetrics,
  after: RetrievalQualityMetrics,
): Partial<RetrievalQualityMetrics> {
  const deltas: Partial<RetrievalQualityMetrics> = {};
  for (const key of Object.keys(before) as Array<keyof RetrievalQualityMetrics>) {
    deltas[key] = Number((after[key] - before[key]).toFixed(4));
  }
  return deltas;
}

export function averageMetrics(
  metrics: RetrievalQualityMetrics[],
): RetrievalQualityMetrics {
  if (metrics.length === 0) {
    return {
      retrievalPrecision: 0,
      retrievalBreadth: 0,
      semanticCohesion: 0,
      contextualDensity: 0,
      rankingStability: 0,
      relationshipUsefulness: 0,
      chunkQuality: 0,
      tokenEfficiency: 0,
      compressionIntegrity: 0,
      renderingQuality: 0,
    };
  }

  const keys = Object.keys(metrics[0]!) as Array<keyof RetrievalQualityMetrics>;
  const result = {} as RetrievalQualityMetrics;
  for (const key of keys) {
    result[key] = Number(
      mean(metrics.map((m) => m[key])).toFixed(4),
    );
  }
  return result;
}
