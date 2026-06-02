import type { MemoryObject } from "./memory-object.js";

export interface ContextPackageMetadata {
  overlap_reduction_applied: boolean;
  summaries_used: boolean;
}

/**
 * Assembled context package ready for downstream LLM consumption.
 */
export interface ContextPackage {
  package_id: string;
  retrieval_id: string;
  memories: MemoryObject[];
  merged_context: string;
  compression_level: string;
  token_usage: {
    estimated_tokens: number;
  };
  metadata: ContextPackageMetadata;
}
