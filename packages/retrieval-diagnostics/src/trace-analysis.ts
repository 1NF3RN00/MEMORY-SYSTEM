import type {
  BuildReportInput,
  ChunkDiagnostics,
  CompressionDiagnostics,
  FactOverrideDiagnostics,
  FullTraceAnalysis,
  QueryDiagnostics,
  RankingDiagnostics,
  RelationshipDiagnostics,
  RenderingDiagnostics,
  RetrievalDiagnostics,
  TraceStageAnalysis,
} from "@memory-middleware/shared-types";
import { normalizeReportInput } from "./snapshot-normalize.js";
import { computeSignalEnrichmentScores } from "./signal-scoring.js";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function analyzeQueryStage(input: BuildReportInput): QueryDiagnostics {
  const preprocessed = input.snapshot.preprocessedQuery;
  const expansion = input.snapshot.contextPackage.retrievalMetadata.expansion;

  const keywordCount = preprocessed?.keywords.length ?? 0;
  const normalizedQueryLength = preprocessed?.normalizedQuery.length ?? input.snapshot.originalQuery.length;

  const decompositionQuality = clamp01(
    keywordCount > 0 ? Math.min(1, keywordCount / 5) : normalizedQueryLength > 10 ? 0.4 : 0.6,
  );

  const preprocessingEffectiveness = preprocessed
    ? clamp01(preprocessed.tokenCount > 0 ? 0.7 + Math.min(0.3, keywordCount * 0.05) : 0.3)
    : 0.5;

  const metadataExpansionQuality = expansion?.expansionApplied
    ? clamp01(expansion.metadataExpansion.enrichmentScore)
    : 0.75;

  const issues: string[] = [];
  if (decompositionQuality < 0.5) issues.push("Weak query decomposition — few operational concepts extracted");
  if (preprocessingEffectiveness < 0.5) issues.push("Preprocessing may not be normalizing query effectively");
  if (expansion?.expansionApplied && metadataExpansionQuality < 0.4) {
    issues.push("Metadata expansion produced low enrichment");
  }

  return {
    decompositionQuality,
    preprocessingEffectiveness,
    metadataExpansionQuality,
    keywordCount,
    normalizedQueryLength,
    issues,
  };
}

export function analyzeRetrievalStage(input: BuildReportInput): RetrievalDiagnostics {
  const pkg = input.snapshot.contextPackage;
  const included = pkg.chunkTraces.filter((c) => c.tokenBudgetDecision === "included");
  const rejectedThreshold = pkg.rejectedCandidates.filter(
    (r) => r.reason === "below_similarity_threshold",
  );

  const candidateQuality = clamp01(mean(included.map((c) => c.semanticSimilarity)));
  const totalCandidates = included.length + pkg.rejectedCandidates.length;
  const retrievalBreadth = clamp01(included.length / Math.max(1, totalCandidates));
  const thresholdImpact = clamp01(rejectedThreshold.length / Math.max(1, totalCandidates));

  const issues: string[] = [];
  if (candidateQuality < 0.55) issues.push("Retrieved candidate semantic similarity is below precision target");
  if (thresholdImpact > 0.6) issues.push("Similarity threshold is rejecting majority of candidates");
  if (included.length === 0) issues.push("No chunks passed retrieval filters — complete retrieval miss");

  return {
    candidateQuality,
    retrievalBreadth,
    thresholdImpact,
    missCount: included.length === 0 ? 1 : 0,
    rejectedBelowThreshold: rejectedThreshold.length,
    includedCount: included.length,
    issues,
  };
}

export function analyzeRankingStage(input: BuildReportInput): RankingDiagnostics {
  const pkg = input.snapshot.contextPackage;
  const included = pkg.chunkTraces.filter((c) => c.tokenBudgetDecision === "included");

  const semanticImpact = clamp01(mean(included.map((c) => c.semanticSimilarity)));
  const boostTotal = included.map(
    (c) => c.importanceBoost + c.recencyBoost + c.reinforcementBoost + c.semanticDensityBoost,
  );
  const boostImpact = clamp01(mean(boostTotal));

  const weights = pkg.rankingBreakdown[0]?.weights;
  const weightValues = weights
    ? [weights.importance, weights.recency, weights.reinforcement, weights.semanticDensity]
    : [0.25, 0.25, 0.25, 0.25];
  const weightSpread = Math.max(...weightValues) - Math.min(...weightValues);
  const weightingBalance = clamp01(1 - weightSpread * 2);

  const scores = included.map((c) => c.finalScore).sort((a, b) => b - a);
  const topScoreSpread = scores.length >= 2 ? scores[0]! - scores[Math.min(4, scores.length - 1)]! : 0;
  const instabilityScore = clamp01(topScoreSpread);

  const issues: string[] = [];
  if (boostImpact > semanticImpact * 0.5) {
    issues.push("Boost signals dominate semantic similarity — ranking may be unstable");
  }
  if (weightingBalance < 0.5) issues.push("Ranking weighting is heavily skewed toward one signal");
  if (instabilityScore > 0.4) issues.push("Large score spread in top ranks indicates ranking sensitivity");

  return {
    semanticSimilarityImpact: semanticImpact,
    boostImpact,
    weightingBalance,
    instabilityScore,
    topScoreSpread,
    issues,
  };
}

export function analyzeChunkStage(input: BuildReportInput): ChunkDiagnostics {
  const pkg = input.snapshot.contextPackage;
  const included = pkg.chunkTraces.filter((c) => c.tokenBudgetDecision === "included");
  const trimmed = pkg.chunkTraces.filter((c) => c.tokenBudgetDecision === "trimmed");

  const tokenCounts = included.map((c) => {
    for (const mem of pkg.memories) {
      const chunk = mem.chunks.find((ch) => ch.chunkId === c.chunkId);
      if (chunk) return chunk.tokenCount;
    }
    return 0;
  });

  const averageChunkSize = mean(tokenCounts);
  const uniqueMemories = new Set(included.map((c) => c.memoryId)).size;
  const semanticFragmentation =
    included.length > 0 ? clamp01(1 - uniqueMemories / included.length) : 0;

  const neighbors = pkg.retrievalMetadata.expansion?.contextualNeighbors ?? [];
  const adjacencyEffectiveness =
    neighbors.length > 0 ? clamp01(neighbors.filter((n) => n.hintWeight > 0.3).length / neighbors.length) : 0.7;

  const hierarchyPreservation = clamp01(
    neighbors.filter((n) => n.relationship === "section" || n.relationship === "sibling").length /
      Math.max(1, neighbors.length) || 0.75,
  );

  const issues: string[] = [];
  if (trimmed.length > included.length) issues.push("More chunks trimmed than included — chunk segmentation may be too granular");
  if (semanticFragmentation > 0.6) issues.push("High chunk fragmentation across memories");
  if (adjacencyEffectiveness < 0.4) issues.push("Adjacency hints are weak or unused");

  return {
    averageChunkSize,
    semanticFragmentation,
    hierarchyPreservation,
    adjacencyEffectiveness,
    trimmedCount: trimmed.length,
    issues,
  };
}

export function analyzeRelationshipStage(input: BuildReportInput): RelationshipDiagnostics {
  const aug = input.relationshipAugmentation;

  if (!aug?.augmentationApplied) {
    return {
      neighborUsefulness: 0.75,
      relationshipPollution: 0,
      confidenceEffectiveness: 0.75,
      augmentationApplied: false,
      neighborCount: 0,
      positiveImpactCount: 0,
      issues: [],
    };
  }

  const positiveImpactCount = aug.rankingImpacts.filter(
    (i) => i.augmentedScore > i.previousScore,
  ).length;
  const neighborUsefulness = clamp01(positiveImpactCount / Math.max(1, aug.neighborCount));
  const relationshipPollution = clamp01(1 - neighborUsefulness);
  const confidenceEffectiveness = neighborUsefulness;

  const issues: string[] = [];
  if (relationshipPollution > 0.5) issues.push("Relationship neighbors are polluting ranked results");
  if (aug.neighborCount > 8) issues.push("High neighbor count may introduce noise");

  return {
    neighborUsefulness,
    relationshipPollution,
    confidenceEffectiveness,
    augmentationApplied: true,
    neighborCount: aug.neighborCount,
    positiveImpactCount,
    issues,
  };
}

export function analyzeCompressionStage(input: BuildReportInput): CompressionDiagnostics {
  const artifact = input.snapshot.compressionArtifacts[0];

  if (!artifact) {
    return {
      mergeQuality: 1,
      tokenSavings: 0,
      fidelityPreservation: 1,
      mergeCount: 0,
      trimCount: 0,
      issues: [],
    };
  }

  const mergeCount = artifact.mergeDecisions.length;
  const trimCount = artifact.trimmingDecisions.length;
  const tokenSavings =
    artifact.optimizedContextPackage?.compressionMetadata.tokenSavings ?? 0;
  const fidelityPreservation = clamp01(artifact.fidelityReport?.fidelityScore ?? 0.9);
  const mergeQuality = clamp01(
    mergeCount > 0
      ? artifact.fidelityReport?.rankingPreservationRatio ?? 0.85
      : 1,
  );

  const issues: string[] = [];
  if (fidelityPreservation < 0.85) issues.push("Compression fidelity below operational threshold");
  if (trimCount > mergeCount * 3) issues.push("Aggressive trimming may be removing valuable context");

  return {
    mergeQuality,
    tokenSavings,
    fidelityPreservation,
    mergeCount,
    trimCount,
    issues,
  };
}

export function analyzeRenderingStage(input: BuildReportInput): RenderingDiagnostics {
  const delivery = input.snapshot.deliveryArtifacts[0];

  if (!delivery?.renderingDecisions) {
    return {
      hierarchyPreservation: 0.7,
      semanticCleanliness: 0.7,
      contextualReadability: 0.7,
      tokenDensityScore: 0.5,
      issues: ["No delivery artifact — rendering stage not observed"],
    };
  }

  const rd = delivery.renderingDecisions;
  const hierarchyPreservation = clamp01(
    rd.hierarchy.hierarchyDepth > 0 ? 0.7 + rd.hierarchy.bulletGroups * 0.05 : 0.5,
  );
  const semanticCleanliness = clamp01(
    1 - rd.traceStripping.removedDiagnosticCount * 0.05,
  );
  const contextualReadability = clamp01(rd.deliveryOptimization.readabilityScore);
  const tokenDensityScore = clamp01(rd.deliveryOptimization.tokenDensityScore);

  const issues: string[] = [];
  if (contextualReadability < 0.6) issues.push("Rendered context readability is below target");
  if (rd.deliveryOptimization.redundancyRemoved === 0 && delivery.deliveryContext.tokenCount > 2000) {
    issues.push("High token count with no redundancy removal");
  }

  return {
    hierarchyPreservation,
    semanticCleanliness,
    contextualReadability,
    tokenDensityScore,
    issues,
  };
}

function findStageLatency(
  input: BuildReportInput,
  stageName: string,
): number {
  const replayStage = input.snapshot.stages.find((s) => s.stage === stageName);
  if (replayStage) return replayStage.latencyMs;

  const retrievalStage = input.snapshot.stages.find((s) =>
    String(s.stage).includes(stageName),
  );
  return retrievalStage?.latencyMs ?? 0;
}

export function buildTraceStageSummaries(input: BuildReportInput): TraceStageAnalysis[] {
  const queryDiag = analyzeQueryStage(input);
  const retrievalDiag = analyzeRetrievalStage(input);
  const rankingDiag = analyzeRankingStage(input);
  const chunkDiag = analyzeChunkStage(input);
  const relDiag = analyzeRelationshipStage(input);
  const compDiag = analyzeCompressionStage(input);
  const renderDiag = analyzeRenderingStage(input);

  const stages: TraceStageAnalysis[] = [
    {
      stage: "query",
      latencyMs: 0,
      status: "completed",
      score: clamp01((queryDiag.decompositionQuality + queryDiag.preprocessingEffectiveness) / 2),
      summary: `Query: ${input.snapshot.originalQuery.slice(0, 80)}`,
      details: { keywordCount: queryDiag.keywordCount },
    },
    {
      stage: "preprocessing",
      latencyMs: findStageLatency(input, "preprocessing"),
      status: input.snapshot.preprocessedQuery ? "completed" : "not_observed",
      score: queryDiag.preprocessingEffectiveness,
      summary: `Preprocessing effectiveness: ${queryDiag.preprocessingEffectiveness.toFixed(2)}`,
      details: { normalizedQuery: input.snapshot.preprocessedQuery?.normalizedQuery },
    },
    {
      stage: "decomposition",
      latencyMs: 0,
      status: queryDiag.keywordCount > 0 ? "completed" : "not_observed",
      score: queryDiag.decompositionQuality,
      summary: `Decomposition quality: ${queryDiag.decompositionQuality.toFixed(2)}`,
      details: { keywords: input.snapshot.preprocessedQuery?.keywords },
    },
    {
      stage: "metadata_expansion",
      latencyMs: 0,
      status: input.snapshot.contextPackage.retrievalMetadata.expansion?.expansionApplied
        ? "completed"
        : "skipped",
      score: queryDiag.metadataExpansionQuality,
      summary: `Metadata expansion: ${queryDiag.metadataExpansionQuality.toFixed(2)}`,
      details: {
        expansion: input.snapshot.contextPackage.retrievalMetadata.expansion,
      },
    },
    {
      stage: "retrieval",
      latencyMs: findStageLatency(input, "vector_retrieval"),
      status: retrievalDiag.includedCount > 0 ? "completed" : "failed",
      score: retrievalDiag.candidateQuality,
      summary: `${retrievalDiag.includedCount} chunks retrieved, ${retrievalDiag.rejectedBelowThreshold} rejected below threshold`,
      details: retrievalDiag as unknown as Record<string, unknown>,
    },
    {
      stage: "ranking",
      latencyMs: findStageLatency(input, "reranking"),
      status: "completed",
      score: clamp01(1 - rankingDiag.instabilityScore),
      summary: `Ranking balance: ${rankingDiag.weightingBalance.toFixed(2)}, boost impact: ${rankingDiag.boostImpact.toFixed(2)}`,
      details: rankingDiag as unknown as Record<string, unknown>,
    },
    {
      stage: "relationships",
      latencyMs: 0,
      status: relDiag.augmentationApplied ? "completed" : "skipped",
      score: relDiag.neighborUsefulness,
      summary: relDiag.augmentationApplied
        ? `${relDiag.neighborCount} neighbors, ${relDiag.positiveImpactCount} positive impacts`
        : "Relationship augmentation not applied",
      details: relDiag as unknown as Record<string, unknown>,
    },
    {
      stage: "compression",
      latencyMs: findStageLatency(input, "compression"),
      status: input.snapshot.compressionArtifacts.length > 0 ? "completed" : "skipped",
      score: compDiag.fidelityPreservation,
      summary:
        compDiag.mergeCount > 0 || compDiag.trimCount > 0
          ? `${compDiag.mergeCount} merges, ${compDiag.trimCount} trims, fidelity ${compDiag.fidelityPreservation.toFixed(2)}`
          : "No compression applied",
      details: compDiag as unknown as Record<string, unknown>,
    },
    {
      stage: "rendering",
      latencyMs: 0,
      status: input.snapshot.deliveryArtifacts.length > 0 ? "completed" : "skipped",
      score: renderDiag.contextualReadability,
      summary: `Readability: ${renderDiag.contextualReadability.toFixed(2)}, hierarchy: ${renderDiag.hierarchyPreservation.toFixed(2)}`,
      details: renderDiag as unknown as Record<string, unknown>,
    },
    {
      stage: "delivery",
      latencyMs: findStageLatency(input, "context_delivery"),
      status: input.snapshot.deliveryArtifacts.length > 0 ? "completed" : "skipped",
      score: renderDiag.tokenDensityScore,
      summary: input.snapshot.deliveryArtifacts[0]
        ? `${input.snapshot.deliveryArtifacts[0].deliveryContext.tokenCount} tokens delivered`
        : "Delivery not observed",
      details: {
        deliveryMode: input.snapshot.deliveryArtifacts[0]?.mode,
        sectionCount: input.snapshot.deliveryArtifacts[0]?.deliveryContext.renderedSections.length,
      },
    },
  ];

  return stages;
}

export function analyzeFactOverrideDiagnostics(
  input: BuildReportInput,
): FactOverrideDiagnostics {
  const pkg = input.snapshot.contextPackage;
  const domainMetadata = pkg.domainMetadata;
  const executionContext = domainMetadata?.executionContext;

  const overrides = domainMetadata?.factOverrides ?? [];
  const globalFactCount = executionContext?.globalFacts.filter((f) => f.status === "active").length ?? 0;
  const domainFactCount = executionContext?.domainFacts.filter((f) => f.status === "active").length ?? 0;
  const instructionCount =
    executionContext?.instructions.filter((i) => i.status === "active" && i.isActive).length ?? 0;

  return {
    overrideCount: overrides.length,
    overrides,
    globalFactCount,
    domainFactCount,
    instructionCount,
    ...(executionContext?.domainKey ? { domainKey: executionContext.domainKey } : {}),
    ...(executionContext?.domainAction ? { domainAction: executionContext.domainAction } : {}),
  };
}

export function buildFullTraceAnalysis(input: BuildReportInput): FullTraceAnalysis {
  const normalized = normalizeReportInput(input);
  return {
    retrievalTraceId: normalized.snapshot.retrievalTraceId,
    query: normalized.snapshot.originalQuery,
    stages: buildTraceStageSummaries(normalized),
    queryDiagnostics: analyzeQueryStage(normalized),
    retrievalDiagnostics: analyzeRetrievalStage(normalized),
    rankingDiagnostics: analyzeRankingStage(normalized),
    chunkDiagnostics: analyzeChunkStage(normalized),
    relationshipDiagnostics: analyzeRelationshipStage(normalized),
    compressionDiagnostics: analyzeCompressionStage(normalized),
    renderingDiagnostics: analyzeRenderingStage(normalized),
    factOverrideDiagnostics: analyzeFactOverrideDiagnostics(normalized),
    generatedAt: new Date().toISOString(),
  };
}

export function buildSignalQualityView(input: BuildReportInput): import("@memory-middleware/shared-types").SignalQualityView {
  const normalized = normalizeReportInput(input);
  const pkg = normalized.snapshot.contextPackage;
  const included = pkg.chunkTraces.filter((c) => c.tokenBudgetDecision === "included");
  const similarities = included.map((c) => c.semanticSimilarity);
  const scores = included.map((c) => c.finalScore);
  const usedTokens = Math.max(1, pkg.tokenBudget.usedTokens);
  const noiseCount = pkg.rejectedCandidates.length + pkg.chunkTraces.filter(
    (c) => c.tokenBudgetDecision === "trimmed",
  ).length;
  const signalCount = included.length;

  const relDiag = analyzeRelationshipStage(input);
  const signalScores = computeSignalEnrichmentScores(normalized);

  return {
    retrievalTraceId: normalized.snapshot.retrievalTraceId,
    query: normalized.snapshot.originalQuery,
    contextualDensity: clamp01(scores.reduce((a, b) => a + b, 0) / Math.max(1, included.length)),
    semanticCohesion: clamp01(1 - (similarities.length > 1
      ? Math.sqrt(similarities.reduce((s, v) => s + (v - mean(similarities)) ** 2, 0) / similarities.length)
      : 0) * 2),
    relationshipUsefulness: relDiag.neighborUsefulness,
    tokenEfficiency: clamp01(scores.reduce((a, b) => a + b, 0) / usedTokens),
    signalToNoiseRatio: clamp01(signalCount / Math.max(1, signalCount + noiseCount)),
    semanticRichness: signalScores.semanticRichness,
    operationalDensity: signalScores.operationalDensity,
    contextualSpecificity: signalScores.contextualSpecificity,
    retrievalAnchorQuality: signalScores.retrievalAnchorQuality,
    generatedAt: new Date().toISOString(),
  };
}
