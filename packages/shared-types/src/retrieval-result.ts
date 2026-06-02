import type { MemoryObject } from "./memory-object.js";

export interface RetrievalMetadata {
  retrieval_strategy: string;
  reranking_applied: boolean;
  traversal_applied: boolean;
}

export interface RetrievalAnalytics {
  latency_ms?: number;
  token_estimate?: number;
}

/**
 * Structured retrieval output contract — no implementation in Sprint 0.
 */
export interface RetrievalResult {
  retrieval_id: string;
  query: string;
  memories: MemoryObject[];
  confidence_score: number;
  retrieval_metadata: RetrievalMetadata;
  analytics?: RetrievalAnalytics;
}
