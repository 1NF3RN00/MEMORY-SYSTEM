import type {
  CompressionStageRecord,
  ContextRenderStageRecord,
  ExecutionStageTiming,
  IngestionStageRecord,
  PlanningStageRecord,
  RetrievalStageRecord,
} from "@memory-middleware/shared-types";

const INGESTION_STAGE_MAP: Record<string, string> = {
  normalized: "normalization",
  chunked: "chunking",
  embedded: "embedding_generation",
  persisted: "memory_storage",
};

const RETRIEVAL_STAGE_MAP: Record<string, string> = {
  preprocessing: "intent_extraction",
  metadata_filtering: "metadata_filtering",
  vector_retrieval: "vector_search",
  keyword_search: "keyword_search",
  reranking: "reranking",
  relationship_expansion: "relationship_expansion",
  deduplication: "deduplication",
  token_budgeting: "token_budgeting",
  context_assembly: "context_assembly",
  domain_execution_context: "domain_resolution",
  graph_traversal: "graph_traversal",
};

function recordToTiming(
  record: { stage: string; startedAt?: string; completedAt?: string; latencyMs?: number },
  stageMap?: Record<string, string>,
): ExecutionStageTiming | null {
  if (record.startedAt == null || record.completedAt == null || record.latencyMs == null) {
    return null;
  }
  return {
    stage: stageMap?.[record.stage] ?? record.stage,
    startTime: record.startedAt,
    endTime: record.completedAt,
    durationMs: record.latencyMs,
  };
}

export function bridgeRetrievalStages(stages: RetrievalStageRecord[]): ExecutionStageTiming[] {
  return stages
    .map((s) => recordToTiming(s, RETRIEVAL_STAGE_MAP))
    .filter((s): s is ExecutionStageTiming => s != null);
}

export function bridgeIngestionStages(stages: IngestionStageRecord[]): ExecutionStageTiming[] {
  return stages
    .map((s) => recordToTiming(s, INGESTION_STAGE_MAP))
    .filter((s): s is ExecutionStageTiming => s != null);
}

export function bridgeCompressionStages(stages: CompressionStageRecord[]): ExecutionStageTiming[] {
  return stages
    .map((s) => recordToTiming(s, { compression: "compression" }))
    .filter((s): s is ExecutionStageTiming => s != null);
}

export function bridgePlanningStages(stages: PlanningStageRecord[]): ExecutionStageTiming[] {
  return stages
    .map((s) =>
      recordToTiming(s, {
        decomposition: "intent_extraction",
        metadata_expansion: "metadata_filtering",
        contextual_weighting: "reranking",
        retrieval_planning: "planning",
      }),
    )
    .filter((s): s is ExecutionStageTiming => s != null);
}

export function bridgeContextRenderStages(
  stages: ContextRenderStageRecord[],
): ExecutionStageTiming[] {
  return stages
    .map((s) =>
      recordToTiming(s, {
        fact_precedence: "fact_resolution",
        instruction_loading: "instruction_loading",
        rendering: "context_rendering",
      }),
    )
    .filter((s): s is ExecutionStageTiming => s != null);
}
