import type {
  CompressionStageTrace,
  TrimmingDecision,
} from "@memory-middleware/shared-types";
import type { ResolvedCompressionConfig } from "./config.js";
import type { MergedChunk } from "./merge.js";

export interface TrimResult {
  kept: MergedChunk[];
  trimmed: MergedChunk[];
  decisions: TrimmingDecision[];
  stageTrace: CompressionStageTrace;
  tokenSavings: number;
  usedTokens: number;
}

function trimValue(chunk: MergedChunk, config: ResolvedCompressionConfig): number {
  const rankingFactor = 1 / (chunk.rankingRank + 1);
  const scoreFactor = chunk.finalScore * chunk.contextualWeight;
  const densityFactor = chunk.tokenCount > 0 ? scoreFactor / chunk.tokenCount : scoreFactor;
  return (
    rankingFactor * config.runtime.trim.rankingWeight +
    scoreFactor * 0.4 +
    densityFactor * 0.3
  );
}

export function rankingAwareTrim(
  chunks: MergedChunk[],
  targetTokens: number,
  config: ResolvedCompressionConfig,
): TrimResult {
  const totalTokens = chunks.reduce((sum, c) => sum + c.tokenCount, 0);

  if (totalTokens <= targetTokens) {
    return {
      kept: [...chunks].sort((a, b) => a.rankingRank - b.rankingRank),
      trimmed: [],
      decisions: [],
      tokenSavings: 0,
      usedTokens: totalTokens,
      stageTrace: {
        compressionStage: "ranking_trim",
        affectedChunks: [],
        tokenSavings: 0,
        fidelityImpact: "none",
        compressionReason: "Within token budget — no trimming required",
        rankingPreservation: true,
        llmUsed: false,
      },
    };
  }

  const minKeep = Math.max(
    1,
    Math.ceil(chunks.length * config.runtime.trim.minRetentionRatio),
  );

  const sortedByValue = [...chunks].sort((a, b) => {
    const va = trimValue(a, config);
    const vb = trimValue(b, config);
    if (va !== vb) return va - vb;
    return a.chunkId.localeCompare(b.chunkId);
  });

  const trimmed: MergedChunk[] = [];
  const decisions: TrimmingDecision[] = [];
  const working = [...sortedByValue];
  let currentTotal = totalTokens;

  while (currentTotal > targetTokens && working.length > minKeep) {
    const removed = working.shift();
    if (!removed) break;
    trimmed.push(removed);
    currentTotal -= removed.tokenCount;
    decisions.push({
      chunkId: removed.chunkId,
      memoryId: removed.memoryId,
      rankingRank: removed.rankingRank,
      finalScore: removed.finalScore,
      tokenCount: removed.tokenCount,
      reason: `Lowest contextual value (rank ${removed.rankingRank}, trim score ${trimValue(removed, config).toFixed(4)})`,
    });
  }

  const kept = working.sort((a, b) => a.rankingRank - b.rankingRank);
  const tokenSavings = trimmed.reduce((sum, c) => sum + c.tokenCount, 0);
  const usedTokens = kept.reduce((sum, c) => sum + c.tokenCount, 0);

  return {
    kept,
    trimmed,
    decisions,
    tokenSavings,
    usedTokens,
    stageTrace: {
      compressionStage: "ranking_trim",
      affectedChunks: trimmed.map((c) => c.chunkId),
      tokenSavings,
      fidelityImpact: trimmed.length > 3 ? "medium" : trimmed.length > 0 ? "low" : "none",
      compressionReason: `Removed ${trimmed.length} lowest-value chunks to meet token budget`,
      rankingPreservation: true,
      llmUsed: false,
      metadata: {
        trimmed_count: trimmed.length,
        kept_count: kept.length,
        target_tokens: targetTokens,
      },
    },
  };
}
