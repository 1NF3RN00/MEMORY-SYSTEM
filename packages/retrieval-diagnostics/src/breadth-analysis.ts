import type {
  BuildReportInput,
  CandidateRejectionAnalysis,
  MetadataExpansionAnalysis,
  RetrievalBreadthAnalysis,
  ScoreHistogramBucket,
} from "@memory-middleware/shared-types";

const BUCKET_COUNT = 10;
const MIN_SCORE = 0.4;
const MAX_SCORE = 1.0;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function buildScoreHistogram(
  scores: Array<{ score: number; accepted: boolean }>,
): ScoreHistogramBucket[] {
  const bucketSize = (MAX_SCORE - MIN_SCORE) / BUCKET_COUNT;
  const buckets: ScoreHistogramBucket[] = [];

  for (let i = 0; i < BUCKET_COUNT; i++) {
    const minScore = MIN_SCORE + i * bucketSize;
    const maxScore = minScore + bucketSize;
    const inBucket = scores.filter((s) => s.score >= minScore && s.score < maxScore);
    buckets.push({
      minScore: round4(minScore),
      maxScore: round4(maxScore),
      count: inBucket.length,
      acceptedCount: inBucket.filter((s) => s.accepted).length,
      rejectedCount: inBucket.filter((s) => !s.accepted).length,
    });
  }

  return buckets;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function analyzeRetrievalBreadth(input: BuildReportInput): RetrievalBreadthAnalysis {
  const pkg = input.snapshot.contextPackage;
  const included = pkg.chunkTraces.filter((c) => c.tokenBudgetDecision === "included");
  const rejectedThreshold = pkg.rejectedCandidates.filter(
    (r) => r.reason === "below_similarity_threshold",
  );

  const vectorStage = input.snapshot.stages?.find((s) => s.stage === "vector_retrieval");
  const stageOutputs = (vectorStage?.outputs ?? {}) as Record<string, unknown>;
  const thresholdCutoff =
    (stageOutputs.threshold as number | undefined) ??
    (stageOutputs.effectiveThreshold as number | undefined) ??
    0.55;

  const scoreEntries: Array<{ score: number; accepted: boolean; memoryId: string }> = [
    ...included.map((c) => ({
      score: c.semanticSimilarity,
      accepted: true,
      memoryId: c.memoryId,
    })),
    ...rejectedThreshold.map((r) => ({
      score: r.semanticSimilarity ?? 0,
      accepted: false,
      memoryId: r.memoryId,
    })),
  ];

  const scoreHistogram = buildScoreHistogram(scoreEntries);
  const candidateCount = scoreEntries.length;
  const acceptedCount = included.length;
  const rejectedCount = rejectedThreshold.length;

  const totalCandidates = Math.max(1, candidateCount);
  const breadthScore = clamp01(acceptedCount / totalCandidates);

  const rejectionConcentration =
    rejectedCount > 0
      ? clamp01(rejectedCount / totalCandidates)
      : 0;

  const memoryScores = new Map<string, number[]>();
  for (const entry of scoreEntries) {
    if (!entry.memoryId) continue;
    const list = memoryScores.get(entry.memoryId) ?? [];
    list.push(entry.score);
    memoryScores.set(entry.memoryId, list);
  }

  const semanticClusters = [...memoryScores.entries()]
    .map(([memoryId, scores]) => ({
      label: memoryId.slice(0, 8),
      chunkCount: scores.length,
      avgScore: round4(scores.reduce((a, b) => a + b, 0) / scores.length),
    }))
    .sort((a, b) => b.avgScore - a.avgScore)
    .slice(0, 8);

  const collapseDetected =
    acceptedCount === 0 ||
    (rejectionConcentration > 0.7 && breadthScore < 0.25);

  return {
    retrievalTraceId: pkg.retrievalTraceId,
    candidateCount,
    acceptedCount,
    rejectedCount,
    thresholdCutoff,
    breadthScore,
    rejectionConcentration,
    scoreHistogram,
    semanticClusters,
    collapseDetected,
    generatedAt: new Date().toISOString(),
  };
}

export function analyzeCandidateRejection(input: BuildReportInput): CandidateRejectionAnalysis {
  const pkg = input.snapshot.contextPackage;

  const rejectedBelowThreshold = pkg.rejectedCandidates.filter(
    (r) => r.reason === "below_similarity_threshold",
  ).length;
  const rejectedTokenBudget = pkg.rejectedCandidates.filter(
    (r) => r.reason === "token_budget_trim",
  ).length;
  const rejectedDeduplication = pkg.rejectedCandidates.filter(
    (r) => r.reason === "deduplication_overlap",
  ).length;

  const included = pkg.chunkTraces.filter((c) => c.tokenBudgetDecision === "included");
  const rejectedThreshold = pkg.rejectedCandidates.filter(
    (r) => r.reason === "below_similarity_threshold",
  );

  const scoreEntries = [
    ...included.map((c) => ({ score: c.semanticSimilarity, accepted: true })),
    ...rejectedThreshold.map((r) => ({
      score: r.semanticSimilarity ?? 0,
      accepted: false,
    })),
  ].sort((a, b) => b.score - a.score);

  const thresholdDistribution = buildScoreHistogram(scoreEntries);

  let cumulativeAccepted = 0;
  let cumulativeRejected = 0;
  const similarityCurve = scoreEntries.map((entry) => {
    if (entry.accepted) cumulativeAccepted += 1;
    else cumulativeRejected += 1;
    return {
      score: round4(entry.score),
      cumulativeAccepted,
      cumulativeRejected,
    };
  });

  return {
    rejectedBelowThreshold,
    rejectedTokenBudget,
    rejectedDeduplication,
    thresholdDistribution,
    similarityCurve,
  };
}

export function analyzeMetadataExpansion(input: BuildReportInput): MetadataExpansionAnalysis {
  const expansion = input.snapshot.contextPackage.retrievalMetadata.expansion;
  const preprocessed = input.snapshot.preprocessedQuery;

  const enrichmentScore = expansion?.metadataExpansion.enrichmentScore ?? 0;
  const matchedKeys = expansion?.metadataExpansion.matchedMetadataKeys ?? [];
  const surfaceTerms = expansion?.metadataExpansion.surfaceExpansionTerms ?? [];
  const expandedTags = expansion?.metadataExpansion.expandedTags ?? [];

  const keywordCount = preprocessed?.keywords.length ?? 0;
  const enrichmentQuality = clamp01(enrichmentScore);
  const metadataUsefulness = clamp01(
    matchedKeys.length > 0 ? Math.min(1, matchedKeys.length / 5) : keywordCount > 0 ? 0.3 : 0,
  );
  const expansionContribution = clamp01(
    (expandedTags.length + surfaceTerms.length) > 0
      ? Math.min(1, (expandedTags.length + surfaceTerms.length) / 12)
      : 0,
  );

  const domainTermCount = expandedTags.filter((t) =>
    ["liquidity", "volatility", "operations", "incident", "compliance", "trading"].some((d) =>
      t.includes(d),
    ),
  ).length;

  return {
    enrichmentQuality,
    metadataUsefulness,
    expansionContribution,
    surfaceTermCount: surfaceTerms.length,
    hierarchyTermCount: matchedKeys.filter((k) => k.startsWith("hierarchy:")).length,
    domainTermCount,
  };
}
