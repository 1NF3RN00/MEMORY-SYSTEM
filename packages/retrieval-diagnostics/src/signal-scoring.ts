import type { BuildReportInput, SemanticSurface } from "@memory-middleware/shared-types";

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export interface SignalEnrichmentScores {
  semanticRichness: number;
  operationalDensity: number;
  contextualSpecificity: number;
  retrievalAnchorQuality: number;
}

/** Deterministic signal scoring from retrieval snapshot — no ML inference. */
export function computeSignalEnrichmentScores(input: BuildReportInput): SignalEnrichmentScores {
  const pkg = input.snapshot.contextPackage;
  const included = pkg.chunkTraces.filter((c) => c.tokenBudgetDecision === "included");
  const expansion = pkg.retrievalMetadata.expansion;
  const preprocessed = input.snapshot.preprocessedQuery;

  const semanticSimilarities = included.map((c) => c.semanticSimilarity);
  const densityBoosts = included.map((c) => c.semanticDensityBoost);

  const semanticRichness = clamp01(
    mean(semanticSimilarities) * 0.6 +
      mean(densityBoosts) * 0.2 +
      (expansion?.metadataExpansion.enrichmentScore ?? 0) * 0.2,
  );

  const uniqueMemories = new Set(included.map((c) => c.memoryId)).size;
  const operationalDensity = clamp01(
    included.length > 0
      ? (uniqueMemories / included.length) * 0.4 +
          mean(included.map((c) => c.importanceBoost + c.reinforcementBoost)) * 0.6
      : 0,
  );

  const keywordCount = preprocessed?.keywords.length ?? 0;
  const expansionTerms = expansion?.metadataExpansion.expandedTags.length ?? 0;
  const contextualSpecificity = clamp01(
    keywordCount > 0 ? Math.min(1, keywordCount / 6) * 0.5 + expansionTerms / 12 * 0.5 : 0.4,
  );

  const neighborHints = expansion?.contextualNeighbors.length ?? 0;
  const matchedKeys = expansion?.metadataExpansion.matchedMetadataKeys.length ?? 0;
  const retrievalAnchorQuality = clamp01(
    included.length > 0
      ? mean(semanticSimilarities) * 0.5 +
          Math.min(1, (neighborHints + matchedKeys) / 8) * 0.3 +
          (expansion?.metadataExpansion.surfaceExpansionTerms?.length ?? 0) / 10 * 0.2
      : 0,
  );

  return {
    semanticRichness,
    operationalDensity,
    contextualSpecificity,
    retrievalAnchorQuality,
  };
}

/** Score semantic surface quality for a chunk during ingestion diagnostics. */
export function scoreSemanticSurfaceQuality(surface: SemanticSurface): number {
  const conceptScore = Math.min(1, surface.primaryConcepts.length / 8);
  const domainScore = Math.min(1, surface.operationalDomains.length / 3);
  const keywordScore = Math.min(1, surface.contextualKeywords.length / 6);
  const hierarchyScore = surface.hierarchyPath?.length ? Math.min(1, surface.hierarchyPath.length / 4) : 0.3;

  return clamp01(conceptScore * 0.35 + domainScore * 0.25 + keywordScore * 0.25 + hierarchyScore * 0.15);
}
