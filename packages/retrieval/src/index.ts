export { mergeRetrievalConfig } from "./config.js";
export {
  preprocessQuery,
  validateRetrievalScope,
  type PreprocessQueryOptions,
} from "./preprocessing.js";
export {
  buildRetrievalEmbeddingText,
  extractQuerySignals,
  type QuerySignalExtraction,
} from "./query-signals.js";
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
  buildQueryEmbeddingCacheKey,
  getDefaultQueryEmbeddingCache,
  QueryEmbeddingCache,
  resetDefaultQueryEmbeddingCache,
  resolveQueryEmbedding,
  type QueryEmbeddingCacheOptions,
  type QueryEmbeddingCacheResult,
} from "./query-embedding-cache.js";
export {
  buildDomainVectorScope,
  filterRelationshipsByNeighborhoodConstraints,
  resolveDomainRetrievalScope,
  type DomainVectorScope,
  type ResolvedDomainRetrievalScope,
  type RelationshipRowForFilter,
} from "./domain-scope.js";
export { appendDomainScopeConditions } from "./domain-scope-sql.js";
export { buildVectorSearchSql, type VectorSearchSqlQuery } from "./vector-search-sql.js";
export {
  buildLexicalSearchSql,
  type LexicalSearchSqlQuery,
} from "./lexical-search-sql.js";
export {
  scoreBm25Documents,
  tokenizeForBm25,
  type Bm25Document,
  type Bm25ScoredDocument,
  type Bm25ScoreOptions,
} from "./bm25-score.js";
export {
  createInMemoryLexicalSearchStore,
  type LexicalSearchCandidate,
  type LexicalSearchStore,
} from "./lexical-search-store.js";
export {
  RRF_K,
  buildLexicalChannelShadow,
  buildRrfMergePreview,
  evaluateParallelBm25Channel,
  runLexicalChannelSearch,
  type ParallelBm25ChannelInput,
  type ParallelBm25ChannelResult,
} from "./parallel-bm25-channel.js";
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
export {
  applyObservationFilters,
  matchesObservationFilter,
  recordToNormalizedObservation,
  retrieveObservations,
  type ObservationMemoryRecord,
  type ObservationRetrievalStore,
} from "./observation-retrieval.js";
