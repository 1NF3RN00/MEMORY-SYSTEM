export interface RetrievalReasonFactor {
  factor: string;
  weight: number;
  explanation: string;
}

/**
 * Deterministic explainability contract for retrieval decisions.
 */
export interface RetrievalReason {
  memory_id: string;
  rank: number;
  score: number;
  factors: RetrievalReasonFactor[];
  accepted: boolean;
  rejection_reason?: string;
}
