import type {
  CompressionStageTrace,
  MergeDecision,
} from "@memory-middleware/shared-types";
import type { OverlapCandidate } from "@memory-middleware/shared-types";
import type { ResolvedCompressionConfig } from "./config.js";
import type { FlatChunk } from "./overlap.js";
import { estimateTokens } from "./token-estimator.js";

export interface MergedChunk extends FlatChunk {
  mergedFrom: string[];
  mergeReason?: string;
}

export interface SemanticMergeResult {
  chunks: MergedChunk[];
  decisions: MergeDecision[];
  stageTrace: CompressionStageTrace;
  tokenSavings: number;
}

function effectiveScore(chunk: FlatChunk): number {
  return chunk.finalScore * chunk.contextualWeight;
}

export function semanticMerge(
  chunks: FlatChunk[],
  overlapCandidates: OverlapCandidate[],
  config: ResolvedCompressionConfig,
): SemanticMergeResult {
  const working = new Map<string, MergedChunk>(
    chunks.map((c) => [
      c.chunkId,
      { ...c, mergedFrom: [c.chunkId] },
    ]),
  );
  const decisions: MergeDecision[] = [];
  let tokenSavings = 0;
  const mergedAway = new Set<string>();

  const mergeable = overlapCandidates.filter(
    (c) =>
      c.overlapScore >= config.runtime.overlap.overlapThreshold &&
      !mergedAway.has(c.chunkIdA) &&
      !mergedAway.has(c.chunkIdB),
  );

  for (const candidate of mergeable) {
    if (mergedAway.has(candidate.chunkIdA) || mergedAway.has(candidate.chunkIdB)) {
      continue;
    }

    const a = working.get(candidate.chunkIdA);
    const b = working.get(candidate.chunkIdB);
    if (!a || !b) continue;

    const keep = effectiveScore(a) >= effectiveScore(b) ? a : b;
    const remove = keep === a ? b : a;
    const combinedBefore = a.tokenCount + b.tokenCount;

    const mergedContent = keep.content;
    const mergedTokens = estimateTokens(mergedContent);
    const savings = Math.max(0, combinedBefore - mergedTokens);
    if (savings === 0) continue;

    tokenSavings += savings;

    const resultId = `${keep.chunkId}__merged`;
    const merged: MergedChunk = {
      ...keep,
      chunkId: resultId,
      content: mergedContent,
      tokenCount: mergedTokens,
      mergedFrom: [...keep.mergedFrom, ...remove.mergedFrom],
      mergeReason: candidate.reason,
    };

    working.delete(a.chunkId);
    working.delete(b.chunkId);
    working.set(resultId, merged);
    mergedAway.add(remove.chunkId);

    decisions.push({
      mergedChunkIds: [a.chunkId, b.chunkId],
      resultChunkId: resultId,
      overlapScore: candidate.overlapScore,
      preservedRank: keep.rankingRank,
      reason: `Merged overlapping chunks into rank ${keep.rankingRank} (overlap ${candidate.overlapScore.toFixed(3)}, saved ${savings} tokens)`,
    });
  }

  const resultChunks = [...working.values()].sort(
    (x, y) => x.rankingRank - y.rankingRank,
  );

  return {
    chunks: resultChunks,
    decisions,
    tokenSavings,
    stageTrace: {
      compressionStage: "semantic_merge",
      affectedChunks: decisions.flatMap((d) => d.mergedChunkIds),
      tokenSavings,
      fidelityImpact: decisions.length > 0 ? "low" : "none",
      compressionReason:
        decisions.length > 0
          ? `Merged ${decisions.length} overlapping fragment pairs`
          : "No merge candidates met threshold",
      rankingPreservation: true,
      llmUsed: false,
      metadata: { merge_count: decisions.length },
    },
  };
}
