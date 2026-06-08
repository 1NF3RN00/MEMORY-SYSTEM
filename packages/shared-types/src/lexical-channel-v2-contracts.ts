/**
 * Sprint 37 — parallel BM25 lexical channel (V2 spike) contracts.
 * Shadow/evaluation shapes only; V1 retrieval output is unchanged when flag is off.
 */

export interface LexicalChannelV2Candidate {
  chunkId: string;
  memoryId: string;
  bm25Score: number;
  rank: number;
}

export interface LexicalChannelV2MergePreview {
  /** Documented merge strategy identifier (see MERGE_STRATEGY.md). */
  strategy: "rrf_k60";
  /** Chunk IDs present in both vector top-K and lexical top-K. */
  overlapWithVector: number;
  /** Top chunk IDs by shadow RRF score — not applied to V1 ranking. */
  previewTopChunkIds: string[];
}

export interface LexicalChannelV2Shadow {
  enabled: true;
  candidateCount: number;
  topCandidates: LexicalChannelV2Candidate[];
  mergePreview: LexicalChannelV2MergePreview;
  durationMs: number;
}
