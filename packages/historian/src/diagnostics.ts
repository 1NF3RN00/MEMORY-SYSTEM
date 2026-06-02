import type {
  OperationalDiagnosticsReport,
  ReplaySnapshot,
  TokenInflationReport,
} from "@memory-middleware/shared-types";

export interface TraceDiagnosticInput {
  retrievalTraceId: string;
  query: string;
  status: string;
  createdAt: string;
  error?: string;
  failedStage?: string;
  snapshot?: ReplaySnapshot;
}

export function buildOperationalDiagnostics(
  workspaceId: string,
  traces: TraceDiagnosticInput[],
): OperationalDiagnosticsReport {
  const now = new Date().toISOString();

  const failedRetrievals = traces
    .filter((t) => t.status === "failed")
    .map((t) => ({
      retrievalTraceId: t.retrievalTraceId,
      query: t.query,
      ...(t.error ? { error: t.error } : {}),
      ...(t.failedStage ? { failedStage: t.failedStage } : {}),
      createdAt: t.createdAt,
    }));

  const lowConfidenceRetrievals = traces
    .filter((t) => t.snapshot && t.status === "completed")
    .map((t) => {
      const snapshot = t.snapshot!;
      const topScore = snapshot.rankingBreakdowns[0]?.finalScore ?? 0;
      const included = snapshot.contextPackage.chunkTraces.filter(
        (c) => c.tokenBudgetDecision === "included",
      ).length;
      return {
        retrievalTraceId: t.retrievalTraceId,
        query: t.query,
        topScore,
        includedChunkCount: included,
        rejectedCount: snapshot.contextPackage.rejectedCandidates.length,
        createdAt: t.createdAt,
      };
    })
    .filter((t) => t.topScore < 0.5 && t.includedChunkCount > 0);

  const tokenWaste = traces
    .filter((t) => t.snapshot && t.status === "completed")
    .map((t) => {
      const pkg = t.snapshot!.contextPackage;
      return {
        retrievalTraceId: t.retrievalTraceId,
        query: t.query,
        trimmedTokens: pkg.tokenBudget.trimmedTokens,
        rejectedByBudget: pkg.chunkTraces.filter(
          (c) => c.tokenBudgetDecision === "trimmed",
        ).length,
        deduplicationRemoved: pkg.chunkTraces.filter(
          (c) => c.deduplicationDecision === "removed_duplicate",
        ).length,
        createdAt: t.createdAt,
      };
    })
    .filter((t) => t.trimmedTokens > 0 || t.rejectedByBudget > 0);

  const contextualDegradation = traces
    .filter((t) => t.snapshot?.compressionArtifacts.length)
    .flatMap((t) => {
      const artifact = t.snapshot!.compressionArtifacts[0]!;
      const entry = {
        retrievalTraceId: t.retrievalTraceId,
        query: t.query,
        createdAt: t.createdAt,
        ...(artifact.fidelityReport?.fidelityScore !== undefined
          ? { fidelityScore: artifact.fidelityReport.fidelityScore }
          : {}),
        ...(artifact.fidelityReport?.compressionAggressiveness !== undefined
          ? { compressionAggressiveness: artifact.fidelityReport.compressionAggressiveness }
          : {}),
        ...(artifact.fidelityReport?.rankingPreservationRatio !== undefined
          ? { rankingPreservationRatio: artifact.fidelityReport.rankingPreservationRatio }
          : {}),
      };
      const degraded =
        (entry.fidelityScore !== undefined && entry.fidelityScore < 0.85) ||
        (entry.compressionAggressiveness !== undefined && entry.compressionAggressiveness > 0.6);
      return degraded ? [entry] : [];
    });

  return {
    workspaceId,
    failedRetrievals,
    lowConfidenceRetrievals,
    tokenWaste,
    contextualDegradation,
    generatedAt: now,
  };
}

export function buildTokenInflationReport(
  workspaceId: string,
  snapshots: ReplaySnapshot[],
): TokenInflationReport {
  const now = new Date().toISOString();
  const usages = snapshots.map((s) => s.contextPackage.tokenBudget.usedTokens);
  const baselineAverage =
    usages.length > 0 ? usages.reduce((a, b) => a + b, 0) / usages.length : 0;

  const entries = snapshots
    .map((s) => {
      const observed = s.contextPackage.tokenBudget.usedTokens;
      const ratio = baselineAverage > 0 ? observed / baselineAverage : 1;
      return {
        retrievalTraceId: s.retrievalTraceId,
        query: s.originalQuery,
        baselineUsedTokens: baselineAverage,
        observedUsedTokens: observed,
        inflationRatio: ratio,
        trimmedTokens: s.contextPackage.tokenBudget.trimmedTokens,
        createdAt: s.replayTimestamp,
      };
    })
    .filter((e) => e.inflationRatio >= 1.2)
    .sort((a, b) => b.inflationRatio - a.inflationRatio);

  return {
    workspaceId,
    baselineAverageTokens: baselineAverage,
    entries,
    generatedAt: now,
  };
}
