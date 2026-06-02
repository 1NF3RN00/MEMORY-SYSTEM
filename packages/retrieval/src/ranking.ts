import type {
  RankingBreakdown,
  RankingWeightsSnapshot,
  RetrievalRuntimeConfig,
  WeightingAdjustments,
} from "@memory-middleware/shared-types";

export interface RankableChunk {
  memoryId: string;
  chunkId: string;
  semanticSimilarity: number;
  importanceScore: number;
  reinforcementScore: number;
  semanticDensityScore: number;
  memoryUpdatedAt: string;
}

export interface RankedChunk extends RankableChunk {
  importanceBoost: number;
  recencyBoost: number;
  reinforcementBoost: number;
  semanticDensityBoost: number;
  finalScore: number;
  retrievalReasons: string[];
  rankingRank: number;
}

function recencyBoost(updatedAt: string, weight: number): number {
  const updated = new Date(updatedAt).getTime();
  const days = Math.max(0, (Date.now() - updated) / 86_400_000);
  const freshness = Math.max(0, 1 - days / 365);
  return freshness * weight;
}

function densityBoost(score: number, weight: number): number {
  const normalized = Math.min(Math.max(score, 0) / 100, 1);
  return normalized * weight;
}

export function rankChunks(
  candidates: RankableChunk[],
  config: RetrievalRuntimeConfig,
  weightingAdjustments?: WeightingAdjustments,
  precisionWeighting = 1.0,
): { ranked: RankedChunk[]; breakdown: RankingBreakdown[] } {
  const baseWeights: RankingWeightsSnapshot = { ...config.ranking };
  const weights: RankingWeightsSnapshot = weightingAdjustments
    ? {
        importance: roundWeight(baseWeights.importance * weightingAdjustments.operational),
        recency: roundWeight(baseWeights.recency * weightingAdjustments.recency),
        reinforcement: roundWeight(baseWeights.reinforcement * weightingAdjustments.reinforcement),
        semanticDensity: roundWeight(
          baseWeights.semanticDensity * weightingAdjustments.semanticDensity,
        ),
      }
    : baseWeights;

  const semanticDominance = precisionWeighting >= 1 ? precisionWeighting : 1 / precisionWeighting;
  const boostScale = precisionWeighting >= 1 ? 1 / precisionWeighting : precisionWeighting;

  const scored = candidates.map((c) => {
    const importanceBoost = Math.min(c.importanceScore / 5, 1) * weights.importance * boostScale;
    const recency = recencyBoost(c.memoryUpdatedAt, weights.recency) * boostScale;
    const reinforcementBoost = Math.min(c.reinforcementScore, 1) * weights.reinforcement * boostScale;
    const semanticDensityBoost = densityBoost(c.semanticDensityScore, weights.semanticDensity) * boostScale;
    const finalScore =
      c.semanticSimilarity * semanticDominance +
      importanceBoost +
      recency +
      reinforcementBoost +
      semanticDensityBoost;

    const retrievalReasons: string[] = [];
    if (c.semanticSimilarity >= 0.8) retrievalReasons.push("high semantic similarity");
    else if (c.semanticSimilarity >= 0.65) retrievalReasons.push("moderate semantic similarity");
    if (importanceBoost >= weights.importance * 0.7) {
      retrievalReasons.push("high importance weighting");
    }
    if (recency >= weights.recency * 0.7) retrievalReasons.push("recent memory");
    if (reinforcementBoost >= weights.reinforcement * 0.5) {
      retrievalReasons.push("recent reinforcement");
    }
    if (semanticDensityBoost >= weights.semanticDensity * 0.5) {
      retrievalReasons.push("high semantic density");
    }
    if (retrievalReasons.length === 0) retrievalReasons.push("vector retrieval match");

    return {
      ...c,
      importanceBoost,
      recencyBoost: recency,
      reinforcementBoost,
      semanticDensityBoost,
      finalScore,
      retrievalReasons,
      rankingRank: 0,
    };
  });

  scored.sort((a, b) => {
    if (b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
    if (b.semanticSimilarity !== a.semanticSimilarity) {
      return b.semanticSimilarity - a.semanticSimilarity;
    }
    return a.chunkId.localeCompare(b.chunkId);
  });

  const ranked = scored.map((item, index) => ({
    ...item,
    rankingRank: index + 1,
  }));

  const breakdown: RankingBreakdown[] = ranked.map((r) => ({
    memoryId: r.memoryId,
    chunkId: r.chunkId,
    semanticSimilarity: r.semanticSimilarity,
    importanceBoost: r.importanceBoost,
    recencyBoost: r.recencyBoost,
    reinforcementBoost: r.reinforcementBoost,
    semanticDensityBoost: r.semanticDensityBoost,
    finalScore: r.finalScore,
    weights,
    rankingRank: r.rankingRank,
  }));

  return { ranked, breakdown };
}

function roundWeight(value: number): number {
  return Math.round(value * 1000) / 1000;
}
