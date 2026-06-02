import type {
  DriftDetectionReport,
  DriftSignal,
  ReplaySnapshot,
} from "@memory-middleware/shared-types";

export interface DriftAnalysisInput {
  workspaceId: string;
  snapshots: ReplaySnapshot[];
  lowConfidenceThreshold?: number;
  tokenInflationThreshold?: number;
  compressionAggressivenessThreshold?: number;
  rankingInstabilityThreshold?: number;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function detectDrift(input: DriftAnalysisInput): DriftDetectionReport {
  const signals: DriftSignal[] = [];
  const now = new Date().toISOString();
  const lowConfidenceThreshold = input.lowConfidenceThreshold ?? 0.45;
  const tokenInflationThreshold = input.tokenInflationThreshold ?? 1.35;
  const compressionThreshold = input.compressionAggressivenessThreshold ?? 0.7;
  const rankingThreshold = input.rankingInstabilityThreshold ?? 0.25;

  const tokenUsages = input.snapshots.map((s) => s.contextPackage.tokenBudget.usedTokens);
  const baselineTokens = average(tokenUsages.slice(Math.floor(tokenUsages.length / 2)));

  for (let i = 1; i < input.snapshots.length; i++) {
    const prev = input.snapshots[i - 1]!;
    const curr = input.snapshots[i]!;

    const prevRanks = new Map(
      prev.rankingBreakdowns.map((r) => [r.chunkId, r.rankingRank]),
    );
    let rankChanges = 0;
    let compared = 0;

    for (const row of curr.rankingBreakdowns) {
      const prevRank = prevRanks.get(row.chunkId);
      if (prevRank !== undefined) {
        compared += 1;
        if (Math.abs(prevRank - row.rankingRank) >= 3) rankChanges += 1;
      }
    }

    if (compared > 0 && rankChanges / compared >= rankingThreshold) {
      signals.push({
        signalType: "ranking_instability",
        severity: rankChanges / compared >= 0.5 ? "high" : "medium",
        workspaceId: input.workspaceId,
        retrievalTraceId: curr.retrievalTraceId,
        replayId: curr.replayId,
        metric: "rank_change_ratio",
        baselineValue: 0,
        observedValue: rankChanges / compared,
        delta: rankChanges / compared,
        detail: `Ranking instability between consecutive traces: ${rankChanges}/${compared} chunks shifted ≥3 ranks`,
        detectedAt: now,
      });
    }
  }

  for (const snapshot of input.snapshots) {
    const used = snapshot.contextPackage.tokenBudget.usedTokens;
    if (baselineTokens > 0 && used / baselineTokens >= tokenInflationThreshold) {
      signals.push({
        signalType: "token_inflation",
        severity: used / baselineTokens >= 1.75 ? "high" : "medium",
        workspaceId: input.workspaceId,
        retrievalTraceId: snapshot.retrievalTraceId,
        replayId: snapshot.replayId,
        metric: "token_inflation_ratio",
        baselineValue: baselineTokens,
        observedValue: used,
        delta: used - baselineTokens,
        detail: `Token usage ${used} exceeds baseline average ${baselineTokens.toFixed(0)} by ${((used / baselineTokens - 1) * 100).toFixed(1)}%`,
        detectedAt: now,
      });
    }

    for (const artifact of snapshot.compressionArtifacts) {
      const aggressiveness = artifact.fidelityReport?.compressionAggressiveness ?? 0;
      if (aggressiveness >= compressionThreshold) {
        signals.push({
          signalType: "compression_aggressiveness",
          severity: aggressiveness >= 0.85 ? "high" : "medium",
          workspaceId: input.workspaceId,
          retrievalTraceId: snapshot.retrievalTraceId,
          replayId: snapshot.replayId,
          metric: "compression_aggressiveness",
          baselineValue: compressionThreshold,
          observedValue: aggressiveness,
          delta: aggressiveness - compressionThreshold,
          detail: `Compression aggressiveness ${aggressiveness.toFixed(2)} exceeds threshold ${compressionThreshold}`,
          detectedAt: now,
        });
      }
    }

    const topScore = snapshot.rankingBreakdowns[0]?.finalScore ?? 0;
    const included = snapshot.contextPackage.chunkTraces.filter(
      (t) => t.tokenBudgetDecision === "included",
    ).length;

    if (topScore < lowConfidenceThreshold && included > 0) {
      signals.push({
        signalType: "retrieval_precision_degradation",
        severity: topScore < 0.3 ? "high" : "medium",
        workspaceId: input.workspaceId,
        retrievalTraceId: snapshot.retrievalTraceId,
        replayId: snapshot.replayId,
        metric: "top_retrieval_score",
        baselineValue: lowConfidenceThreshold,
        observedValue: topScore,
        delta: topScore - lowConfidenceThreshold,
        detail: `Low top retrieval score ${topScore.toFixed(3)} with ${included} included chunks`,
        detectedAt: now,
      });
    }

    const reinforcementBoosts = snapshot.rankingBreakdowns.map((r) => r.reinforcementBoost);
    const avgReinforcement = average(reinforcementBoosts);
    const semanticScores = snapshot.rankingBreakdowns.map((r) => r.semanticSimilarity);
    const avgSemantic = average(semanticScores);

    if (
      reinforcementBoosts.length > 0 &&
      avgReinforcement > avgSemantic * 0.8 &&
      avgReinforcement > 0.15
    ) {
      signals.push({
        signalType: "reinforcement_bias",
        severity: avgReinforcement > 0.25 ? "high" : "low",
        workspaceId: input.workspaceId,
        retrievalTraceId: snapshot.retrievalTraceId,
        replayId: snapshot.replayId,
        metric: "reinforcement_to_semantic_ratio",
        baselineValue: avgSemantic,
        observedValue: avgReinforcement,
        delta: avgReinforcement - avgSemantic,
        detail: `Reinforcement boost (${avgReinforcement.toFixed(3)}) dominates semantic similarity (${avgSemantic.toFixed(3)})`,
        detectedAt: now,
      });
    }
  }

  return {
    workspaceId: input.workspaceId,
    signals,
    analyzedTraceCount: input.snapshots.length,
    generatedAt: now,
  };
}
