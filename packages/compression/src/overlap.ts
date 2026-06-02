import type {
  CompressionStageTrace,
  ContextPackage,
  OverlapCandidate,
} from "@memory-middleware/shared-types";
import type { ResolvedCompressionConfig } from "./config.js";

export interface FlatChunk {
  chunkId: string;
  memoryId: string;
  content: string;
  tokenCount: number;
  finalScore: number;
  rankingRank: number;
  contextualWeight: number;
}

export function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length > 2),
  );
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function flattenContextPackage(
  pkg: ContextPackage,
  contextualWeights: Record<string, number>,
): FlatChunk[] {
  const chunks: FlatChunk[] = [];

  for (const memory of pkg.memories) {
    for (const chunk of memory.chunks) {
      chunks.push({
        chunkId: chunk.chunkId,
        memoryId: memory.memoryId,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        finalScore: chunk.finalScore,
        rankingRank: chunk.rankingRank,
        contextualWeight: contextualWeights[chunk.chunkId] ?? 1,
      });
    }
  }

  return chunks.sort((a, b) => a.rankingRank - b.rankingRank);
}

export interface OverlapDetectionResult {
  candidates: OverlapCandidate[];
  stageTrace: CompressionStageTrace;
}

export function detectOverlap(
  chunks: FlatChunk[],
  config: ResolvedCompressionConfig,
): OverlapDetectionResult {
  const candidates: OverlapCandidate[] = [];
  const tokenSets = chunks.map((c) => ({
    chunk: c,
    tokens: tokenSet(c.content),
  }));

  for (let i = 0; i < tokenSets.length; i += 1) {
    for (let j = i + 1; j < tokenSets.length; j += 1) {
      const a = tokenSets[i]!;
      const b = tokenSets[j]!;
      const score = jaccardSimilarity(a.tokens, b.tokens);

      if (score < config.runtime.overlap.overlapThreshold * 0.85) continue;

      const isDuplicate = score >= config.runtime.overlap.duplicateThreshold;
      candidates.push({
        chunkIdA: a.chunk.chunkId,
        chunkIdB: b.chunk.chunkId,
        memoryIdA: a.chunk.memoryId,
        memoryIdB: b.chunk.memoryId,
        overlapScore: score,
        isDuplicateCandidate: isDuplicate,
        reason: isDuplicate
          ? `${(score * 100).toFixed(0)}% semantic overlap — duplicate candidate`
          : `${(score * 100).toFixed(0)}% semantic overlap — merge candidate`,
      });
    }
  }

  candidates.sort((x, y) => y.overlapScore - x.overlapScore);

  const affected = [
    ...new Set(candidates.flatMap((c) => [c.chunkIdA, c.chunkIdB])),
  ];

  return {
    candidates,
    stageTrace: {
      compressionStage: "overlap_detection",
      affectedChunks: affected,
      tokenSavings: 0,
      fidelityImpact: "none",
      compressionReason: `Detected ${candidates.length} overlap candidates (${candidates.filter((c) => c.isDuplicateCandidate).length} duplicates)`,
      rankingPreservation: true,
      llmUsed: false,
      metadata: {
        candidate_count: candidates.length,
        duplicate_count: candidates.filter((c) => c.isDuplicateCandidate).length,
      },
    },
  };
}
