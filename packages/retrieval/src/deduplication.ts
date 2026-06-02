import type {
  DeduplicationDecision,
  RejectedCandidate,
  RetrievalRuntimeConfig,
} from "@memory-middleware/shared-types";
import type { RankedChunk } from "./ranking.js";

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((t) => t.length > 2),
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export interface DeduplicationResult {
  kept: RankedChunk[];
  removed: Array<{
    chunk: RankedChunk;
    overlapWith: string;
    similarity: number;
  }>;
}

export function deduplicateChunks(
  ranked: RankedChunk[],
  contents: Map<string, string>,
  config: RetrievalRuntimeConfig,
): DeduplicationResult {
  const kept: RankedChunk[] = [];
  const removed: DeduplicationResult["removed"] = [];
  const keptSets: Array<{ chunkId: string; tokens: Set<string> }> = [];

  for (const chunk of ranked) {
    const content = contents.get(chunk.chunkId) ?? "";
    const tokens = tokenSet(content);
    let isDuplicate = false;

    for (const existing of keptSets) {
      const similarity = jaccardSimilarity(tokens, existing.tokens);
      if (similarity >= config.deduplication.overlapThreshold) {
        removed.push({
          chunk,
          overlapWith: existing.chunkId,
          similarity,
        });
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      kept.push(chunk);
      keptSets.push({ chunkId: chunk.chunkId, tokens });
    }
  }

  return { kept, removed };
}

export function deduplicationRejections(
  removed: DeduplicationResult["removed"],
): RejectedCandidate[] {
  return removed.map((r) => ({
    memoryId: r.chunk.memoryId,
    chunkId: r.chunk.chunkId,
    reason: "deduplication_overlap",
    detail: `Overlaps chunk ${r.overlapWith} (Jaccard ${r.similarity.toFixed(3)})`,
    semanticSimilarity: r.chunk.semanticSimilarity,
    finalScore: r.chunk.finalScore,
  }));
}

export function deduplicationDecision(
  chunkId: string,
  kept: RankedChunk[],
  removed: DeduplicationResult["removed"],
): DeduplicationDecision {
  if (kept.some((k) => k.chunkId === chunkId)) return "kept";
  if (removed.some((r) => r.chunk.chunkId === chunkId)) return "removed_duplicate";
  return "kept";
}
