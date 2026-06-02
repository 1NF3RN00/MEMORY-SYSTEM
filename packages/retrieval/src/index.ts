export { mergeRetrievalConfig } from "./config.js";
export { preprocessQuery, validateRetrievalScope } from "./preprocessing.js";
export { rankChunks, type RankableChunk, type RankedChunk } from "./ranking.js";
export {
  deduplicateChunks,
  deduplicationRejections,
  type DeduplicationResult,
} from "./deduplication.js";
export { applyTokenBudget, tokenBudgetRejections } from "./token-budget.js";
export { assembleContextPackage } from "./assembly.js";
export {
  emitRetrievalStarted,
  emitPreprocessingCompleted,
  emitVectorRetrievalCompleted,
  emitRerankingCompleted,
  emitDeduplicationCompleted,
  emitTokenBudgetingCompleted,
  emitContextAssemblyCompleted,
  emitRetrievalCompleted,
  emitRetrievalFailed,
} from "./events.js";
export {
  runRetrievalPipeline,
  type RunRetrievalInput,
  type RunRetrievalResult,
} from "./pipeline.js";
export {
  applyRetrievalExpansion,
  buildContextualNeighborHints,
  buildStructureView,
  expandRetrievalMetadata,
  type ChunkAdjacencyLookup,
  type MemoryMetadataLookup,
} from "./expansion.js";
export {
  applySimilarityThreshold,
  MIN_SIMILARITY_THRESHOLD,
  THRESHOLD_RETRY_DELTA,
  topKForMode,
  similarityThresholdForMode,
  vectorRejections,
  type SimilarityThresholdResult,
  type VectorSearchCandidate,
  type VectorSearchFilter,
  type VectorSearchStore,
} from "./vector-retrieval.js";
export {
  applyCalibrationToRetrievalConfig,
  resolveCalibratedRetrievalParams,
  type CalibratedRetrievalParams,
} from "./threshold-calibration.js";
