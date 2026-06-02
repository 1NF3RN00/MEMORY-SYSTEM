import type { RetrievalResult } from "./retrieval-result.js";

export interface RetrievalConstraints {
  token_budget?: number;
  latency_target_ms?: number;
}

export interface RetrievalRequest {
  workspace_id: string;
  query: string;
  trace_id: string;
  constraints?: RetrievalConstraints;
}

/**
 * Retrieval engine interface — contract only, no implementation in Sprint 0.
 */
export interface RetrievalEngine {
  retrieve(request: RetrievalRequest): Promise<RetrievalResult>;
}
