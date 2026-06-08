import type {
  LexicalChannelV2Candidate,
  LexicalChannelV2MergePreview,
  LexicalChannelV2Shadow,
} from "@memory-middleware/shared-types";
import type { LexicalSearchCandidate, LexicalSearchStore } from "./lexical-search-store.js";
import type { VectorSearchCandidate, VectorSearchFilter } from "./vector-retrieval.js";

/** RRF constant documented in sprint-37 MERGE_STRATEGY.md. */
export const RRF_K = 60;

export interface ParallelBm25ChannelInput {
  queryText: string;
  queryTerms: string[];
  filter: VectorSearchFilter;
  topK: number;
  lexicalStore: LexicalSearchStore;
  /** Vector channel top candidates for shadow merge preview only. */
  vectorCandidates: Array<Pick<VectorSearchCandidate, "chunkId" | "memoryId">>;
}

export interface ParallelBm25ChannelResult {
  shadow: LexicalChannelV2Shadow;
  lexicalCandidates: LexicalSearchCandidate[];
}

function toLexicalChannelCandidates(
  candidates: LexicalSearchCandidate[],
): LexicalChannelV2Candidate[] {
  return candidates.map((candidate, index) => ({
    chunkId: candidate.chunkId,
    memoryId: candidate.memoryId,
    bm25Score: candidate.lexicalScore,
    rank: index + 1,
  }));
}

/**
 * Shadow-only reciprocal rank fusion preview.
 * Does NOT alter V1 vector ranking — evaluation artifact for sprint spike.
 */
export function buildRrfMergePreview(
  vectorChunkIds: string[],
  lexicalChunkIds: string[],
  previewLimit = 10,
): LexicalChannelV2MergePreview {
  const vectorRank = new Map(vectorChunkIds.map((id, index) => [id, index + 1]));
  const lexicalRank = new Map(lexicalChunkIds.map((id, index) => [id, index + 1]));

  const overlap = vectorChunkIds.filter((id) => lexicalRank.has(id)).length;

  const unionIds = [...new Set([...vectorChunkIds, ...lexicalChunkIds])];
  const rrfScores = unionIds
    .map((chunkId) => {
      let score = 0;
      const vRank = vectorRank.get(chunkId);
      const lRank = lexicalRank.get(chunkId);
      if (vRank !== undefined) score += 1 / (RRF_K + vRank);
      if (lRank !== undefined) score += 1 / (RRF_K + lRank);
      return { chunkId, score };
    })
    .sort((a, b) => b.score - a.score || a.chunkId.localeCompare(b.chunkId));

  return {
    strategy: "rrf_k60",
    overlapWithVector: overlap,
    previewTopChunkIds: rrfScores.slice(0, previewLimit).map((entry) => entry.chunkId),
  };
}

/** Runs lexical search — intended to execute in parallel with vector embed/search. */
export async function runLexicalChannelSearch(
  input: Omit<ParallelBm25ChannelInput, "vectorCandidates">,
): Promise<LexicalSearchCandidate[]> {
  return input.lexicalStore.search(
    input.queryText,
    input.queryTerms,
    input.filter,
    input.topK,
  );
}

/** Builds shadow metadata after both channels complete. Does not alter V1 ranking. */
export function buildLexicalChannelShadow(
  lexicalCandidates: LexicalSearchCandidate[],
  vectorCandidates: Array<Pick<VectorSearchCandidate, "chunkId" | "memoryId">>,
  startedAtMs: number,
): LexicalChannelV2Shadow {
  const topCandidates = toLexicalChannelCandidates(lexicalCandidates);
  const mergePreview = buildRrfMergePreview(
    vectorCandidates.map((candidate) => candidate.chunkId),
    lexicalCandidates.map((candidate) => candidate.chunkId),
  );

  return {
    enabled: true,
    candidateCount: lexicalCandidates.length,
    topCandidates,
    mergePreview,
    durationMs: Date.now() - startedAtMs,
  };
}

/**
 * Runs the V2 parallel lexical channel in shadow mode (convenience wrapper for tests).
 * Results are attached to trace metadata only — V1 ranking path is unchanged.
 */
export async function evaluateParallelBm25Channel(
  input: ParallelBm25ChannelInput,
  startedAtMs: number,
): Promise<ParallelBm25ChannelResult> {
  const lexicalCandidates = await runLexicalChannelSearch(input);
  return {
    lexicalCandidates,
    shadow: buildLexicalChannelShadow(lexicalCandidates, input.vectorCandidates, startedAtMs),
  };
}
