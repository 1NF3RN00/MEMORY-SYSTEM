import type {
  BenchmarkComparisonResult,
  ContextPackage,
  OptimizedContextPackage,
  RankingComparisonEntry,
  ReplaySnapshot,
} from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";

function rankMapFromPackage(pkg: ContextPackage): Map<string, { rank: number; score: number; memoryId: string }> {
  const map = new Map<string, { rank: number; score: number; memoryId: string }>();

  for (const row of pkg.rankingBreakdown) {
    map.set(row.chunkId, {
      rank: row.rankingRank,
      score: row.finalScore,
      memoryId: row.memoryId,
    });
  }

  for (const trace of pkg.chunkTraces) {
    if (!map.has(trace.chunkId)) {
      map.set(trace.chunkId, {
        rank: trace.rankingRank,
        score: trace.finalScore,
        memoryId: trace.memoryId,
      });
    }
  }

  return map;
}

export function compareRankings(
  original: ContextPackage,
  benchmark: ContextPackage,
): RankingComparisonEntry[] {
  const originalMap = rankMapFromPackage(original);
  const benchmarkMap = rankMapFromPackage(benchmark);
  const allChunkIds = new Set([...originalMap.keys(), ...benchmarkMap.keys()]);

  const entries: RankingComparisonEntry[] = [];

  for (const chunkId of allChunkIds) {
    const orig = originalMap.get(chunkId);
    const bench = benchmarkMap.get(chunkId);

    const originalRank = orig?.rank ?? null;
    const benchmarkRank = bench?.rank ?? null;

    entries.push({
      chunkId,
      memoryId: orig?.memoryId ?? bench?.memoryId ?? "unknown",
      originalRank,
      benchmarkRank,
      rankDelta:
        originalRank !== null && benchmarkRank !== null
          ? benchmarkRank - originalRank
          : null,
      originalScore: orig?.score ?? null,
      benchmarkScore: bench?.score ?? null,
      scoreDelta:
        orig?.score !== undefined && bench?.score !== undefined
          ? bench.score - orig.score
          : null,
    });
  }

  return entries.sort((a, b) => {
    const aRank = a.originalRank ?? a.benchmarkRank ?? 9999;
    const bRank = b.originalRank ?? b.benchmarkRank ?? 9999;
    return aRank - bRank;
  });
}

export function buildBenchmarkComparison(input: {
  originalSnapshot: ReplaySnapshot;
  benchmarkContextPackage?: ContextPackage;
  benchmarkOptimizedPackage?: OptimizedContextPackage;
}): BenchmarkComparisonResult {
  const original = input.originalSnapshot.contextPackage;
  const benchmark =
    input.benchmarkOptimizedPackage ?? input.benchmarkContextPackage ?? original;

  const rankingComparison = compareRankings(original, benchmark);

  const originalArtifact = input.originalSnapshot.compressionArtifacts[0];
  const benchmarkMeta = input.benchmarkOptimizedPackage?.compressionMetadata;

  return {
    benchmarkId: newUlid(),
    retrievalTraceId: input.originalSnapshot.retrievalTraceId,
    workspaceId: input.originalSnapshot.workspaceId,
    originalSnapshot: input.originalSnapshot,
    ...(input.benchmarkContextPackage
      ? { benchmarkContextPackage: input.benchmarkContextPackage }
      : {}),
    ...(input.benchmarkOptimizedPackage
      ? { benchmarkOptimizedPackage: input.benchmarkOptimizedPackage }
      : {}),
    rankingComparison,
    tokenEfficiency: {
      originalUsedTokens: original.tokenBudget.usedTokens,
      benchmarkUsedTokens: benchmark.tokenBudget.usedTokens,
      tokenDelta: benchmark.tokenBudget.usedTokens - original.tokenBudget.usedTokens,
      originalTrimmedTokens: original.tokenBudget.trimmedTokens,
      benchmarkTrimmedTokens: benchmark.tokenBudget.trimmedTokens,
    },
    ...(originalArtifact || benchmarkMeta
      ? {
          compressionComparison: {
            originalFidelityScore: originalArtifact?.fidelityReport?.fidelityScore ?? null,
            benchmarkFidelityScore: benchmarkMeta?.fidelityScore ?? null,
            originalTokenSavings:
              originalArtifact?.optimizedContextPackage?.compressionMetadata.tokenSavings ?? null,
            benchmarkTokenSavings: benchmarkMeta?.tokenSavings ?? null,
            mergeCountDelta:
              (benchmarkMeta ? input.benchmarkOptimizedPackage?.compressionMetadata.stages.filter(
                (s) => s.compressionStage === "semantic_merge",
              ).length ?? 0 : 0) -
              (originalArtifact?.mergeDecisions.length ?? 0),
            trimCountDelta:
              (benchmarkMeta ? input.benchmarkOptimizedPackage?.compressionMetadata.stages.filter(
                (s) => s.compressionStage === "ranking_trim",
              ).length ?? 0 : 0) -
              (originalArtifact?.trimmingDecisions.length ?? 0),
          },
        }
      : {}),
    chunkingComparison: {
      originalChunkCount: original.retrievalMetadata.finalChunkCount,
      benchmarkChunkCount: benchmark.retrievalMetadata.finalChunkCount,
      chunkCountDelta:
        benchmark.retrievalMetadata.finalChunkCount -
        original.retrievalMetadata.finalChunkCount,
    },
    executedAt: new Date().toISOString(),
  };
}

export function detectRankingInstability(
  comparison: BenchmarkComparisonResult,
  threshold = 3,
): boolean {
  const unstable = comparison.rankingComparison.filter(
    (e) => e.rankDelta !== null && Math.abs(e.rankDelta) >= threshold,
  );
  return unstable.length > 0;
}
