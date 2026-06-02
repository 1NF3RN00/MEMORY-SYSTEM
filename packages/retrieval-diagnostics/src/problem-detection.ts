import type {
  BuildReportInput,
  DetectedProblem,
  DiagnosticSeverity,
  PipelineStageName,
  RetrievalQualityMetrics,
} from "@memory-middleware/shared-types";

function severityFromScore(score: number, thresholds: [number, number]): DiagnosticSeverity {
  if (score < thresholds[0]) return "high";
  if (score < thresholds[1]) return "medium";
  return "low";
}

export function detectProblems(
  metrics: RetrievalQualityMetrics,
  input: BuildReportInput,
): DetectedProblem[] {
  const problems: DetectedProblem[] = [];
  const pkg = input.snapshot.contextPackage;

  if (metrics.retrievalPrecision < 0.55) {
    problems.push({
      stage: "retrieval",
      severity: severityFromScore(metrics.retrievalPrecision, [0.4, 0.55]),
      issue: `Low retrieval precision (${metrics.retrievalPrecision.toFixed(2)}) — included chunks have weak semantic alignment to query`,
      recommendation: "Raise semantic threshold or switch to precision retrieval mode; inspect rejected candidates below threshold",
    });
  }

  if (metrics.retrievalBreadth < 0.35) {
    problems.push({
      stage: "retrieval",
      severity: severityFromScore(metrics.retrievalBreadth, [0.2, 0.35]),
      issue: `Narrow retrieval breadth (${metrics.retrievalBreadth.toFixed(2)}) — contextual coverage is insufficient`,
      recommendation: "Increase top-k or retrieval breadth multiplier; review scope filters and timeframe constraints",
    });
  }

  if (metrics.semanticCohesion < 0.5) {
    problems.push({
      stage: "ranking",
      severity: severityFromScore(metrics.semanticCohesion, [0.3, 0.5]),
      issue: `Low semantic cohesion (${metrics.semanticCohesion.toFixed(2)}) — retrieved chunks are semantically divergent`,
      recommendation: "Tighten similarity threshold; reduce exploratory expansion; review metadata expansion pollution",
    });
  }

  if (metrics.contextualDensity < 0.4) {
    problems.push({
      stage: "retrieval",
      severity: severityFromScore(metrics.contextualDensity, [0.25, 0.4]),
      issue: `Low contextual density (${metrics.contextualDensity.toFixed(2)}) — high token cost relative to signal`,
      recommendation: "Enable compression with fidelity preservation; trim low-ranking chunks earlier in token budgeting",
    });
  }

  if (metrics.rankingStability < 0.6) {
    problems.push({
      stage: "ranking",
      severity: severityFromScore(metrics.rankingStability, [0.4, 0.6]),
      issue: `Ranking instability detected (${metrics.rankingStability.toFixed(2)}) — rank order is sensitive to weighting`,
      recommendation: "Review recency and reinforcement weighting; benchmark against historical traces before changing weights",
    });
  }

  if (metrics.relationshipUsefulness < 0.35) {
    problems.push({
      stage: "relationships",
      severity: severityFromScore(metrics.relationshipUsefulness, [0.2, 0.35]),
      issue: `Relationship augmentation adds noise (${metrics.relationshipUsefulness.toFixed(2)})`,
      recommendation: "Raise relationship confidence threshold; reduce augmentation weighting; limit neighbor count",
    });
  }

  if (metrics.chunkQuality < 0.6) {
    problems.push({
      stage: "retrieval",
      severity: severityFromScore(metrics.chunkQuality, [0.4, 0.6]),
      issue: `Chunk quality degraded (${metrics.chunkQuality.toFixed(2)}) — excessive trimming or deduplication`,
      recommendation: "Review chunk size and hierarchy sensitivity; increase token budget or reduce overlap deduplication threshold",
    });
  }

  if (metrics.tokenEfficiency < 0.3) {
    problems.push({
      stage: "delivery",
      severity: severityFromScore(metrics.tokenEfficiency, [0.15, 0.3]),
      issue: `Poor token efficiency (${metrics.tokenEfficiency.toFixed(4)}) — contextual value per token is low`,
      recommendation: "Apply compression with maximum fidelity; enable delivery density optimization",
    });
  }

  if (metrics.compressionIntegrity < 0.85) {
    problems.push({
      stage: "compression",
      severity: severityFromScore(metrics.compressionIntegrity, [0.7, 0.85]),
      issue: `Compression harms retrieval fidelity (${metrics.compressionIntegrity.toFixed(2)})`,
      recommendation: "Reduce fidelity aggressiveness; increase merge sensitivity; use maximum_fidelity mode",
    });
  }

  if (metrics.renderingQuality < 0.6) {
    problems.push({
      stage: "rendering",
      severity: severityFromScore(metrics.renderingQuality, [0.4, 0.6]),
      issue: `Rendering weakens inference clarity (${metrics.renderingQuality.toFixed(2)})`,
      recommendation: "Increase hierarchy preservation; use detailed or operational delivery mode; review grouping decisions",
    });
  }

  const rejectedThreshold = pkg.rejectedCandidates.filter(
    (r) => r.reason === "below_similarity_threshold",
  ).length;
  if (rejectedThreshold > includedCount(pkg) * 2) {
    problems.push({
      stage: "preprocessing",
      severity: "medium",
      issue: `${rejectedThreshold} candidates rejected below similarity threshold — possible preprocessing or threshold mismatch`,
      recommendation: "Inspect query preprocessing normalization; consider lowering semantic threshold for this query class",
    });
  }

  const preprocessed = input.snapshot.preprocessedQuery;
  if (preprocessed && preprocessed.keywords.length === 0 && preprocessed.tokenCount > 3) {
    problems.push({
      stage: "preprocessing",
      severity: "low",
      issue: "Preprocessing produced no extractable keywords from a multi-token query",
      recommendation: "Review preprocessing tokenization; verify query decomposition pipeline",
    });
  }

  const expansion = pkg.retrievalMetadata.expansion;
  if (expansion?.expansionApplied && expansion.metadataExpansion.enrichmentScore < 0.3) {
    problems.push({
      stage: "metadata_expansion",
      severity: "medium",
      issue: "Metadata expansion applied but enrichment score is low",
      recommendation: "Review metadata tag coverage on memories; reduce expansion breadth to avoid noise",
    });
  }

  return problems;
}

function includedCount(pkg: BuildReportInput["snapshot"]["contextPackage"]): number {
  return pkg.chunkTraces.filter((c) => c.tokenBudgetDecision === "included").length;
}

export function countProblemsByStage(
  reports: Array<{ detectedProblems: DetectedProblem[] }>,
): Record<PipelineStageName, number> {
  const counts: Record<PipelineStageName, number> = {
    query: 0,
    preprocessing: 0,
    decomposition: 0,
    metadata_expansion: 0,
    retrieval: 0,
    ranking: 0,
    relationships: 0,
    compression: 0,
    rendering: 0,
    delivery: 0,
  };

  for (const report of reports) {
    for (const problem of report.detectedProblems) {
      counts[problem.stage] += 1;
    }
  }

  return counts;
}
