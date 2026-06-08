export type ExecutionStageName =
  | "query_received"
  | "intent_extraction"
  | "metadata_filtering"
  | "vector_search"
  | "keyword_search"
  | "relationship_expansion"
  | "fact_resolution"
  | "domain_resolution"
  | "reranking"
  | "compression"
  | "context_assembly"
  | "response"
  | "ingestion"
  | "normalization"
  | "chunking"
  | "embedding_generation"
  | "memory_storage"
  | "retrieval"
  | "deduplication"
  | "token_budgeting"
  | "instruction_loading"
  | "graph_traversal"
  | "api_handler"
  | "preprocessing"
  | "vector_retrieval"
  | "planning"
  | "context_rendering";

export interface ExecutionStageTiming {
  stage: ExecutionStageName | string;
  startTime: string;
  endTime: string;
  durationMs: number;
}

export interface ExecutionTimingAudit {
  requestId: string;
  totalLatency: number;
  stages: ExecutionStageTiming[];
}
