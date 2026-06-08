/**
 * Sprint 2 retrieval contracts — authoritative API and trace shapes.
 */

import type { ExecutionTimingAudit } from "./execution-timing-contracts.js";
import type { LlmCallAudit } from "./llm-call-contracts.js";
import type { RetrievalDbObservability } from "./database-query-contracts.js";

export type RetrievalMode =
  | "precision"
  | "expanded"
  | "exploratory"
  | "incident-response";

export interface RetrievalQuery {
  workspaceId: string;
  query: string;
  tokenBudget: number;
  retrievalMode: RetrievalMode;
  /** Optional Sprint 6 retrieval plan — when set, weighting and hints from plan are applied. */
  planId?: string;
  memoryTypes?: string[];
  timeframe?: {
    start?: string;
    end?: string;
  };
  /** Domain Engine — task-scoped retrieval boundary (optional) */
  domainKey?: string;
  /** Maps to instruction actionKey when domainKey is set */
  domainAction?: string;
  /** Optional observation filter overrides when domain-scoped */
  observationFilters?: import("./observation-contracts.js").ObservationFilter[];
}

export interface RetrievalTokenBudget {
  maxTokens: number;
  usedTokens: number;
  trimmedTokens: number;
}

export interface RetrievalPipelineMetadata {
  retrievalLatencyMs: number;
  retrievedChunkCount: number;
  deduplicatedChunkCount: number;
  finalChunkCount: number;
  /** Sprint 4 — retrieval expansion (metadata + neighbor hints) */
  expansion?: import("./structural-contracts.js").RetrievalExpansionResult;
  /** Sprint 37 — shadow lexical channel evaluation (V2 spike, flag-gated) */
  lexicalChannelV2Shadow?: import("./lexical-channel-v2-contracts.js").LexicalChannelV2Shadow;
  /** Domain Engine — task identity when domain-scoped retrieve */
  domainKey?: string;
  domainAction?: string;
}

export interface RetrievedChunk {
  chunkId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  finalScore: number;
  rankingRank: number;
}

export interface RetrievedMemory {
  memoryId: string;
  title: string;
  memoryType: string;
  version: number;
  summary?: string;
  lineage: {
    ingestionTraceId: string;
    normalizationTraceId: string;
  };
  chunks: RetrievedChunk[];
  memoryScore: number;
}

export type DeduplicationDecision = "kept" | "removed_duplicate";
export type TokenBudgetDecision = "included" | "trimmed" | "rejected_threshold";

export interface ChunkRetrievalTrace {
  memoryId: string;
  chunkId: string;
  semanticSimilarity: number;
  importanceBoost: number;
  recencyBoost: number;
  reinforcementBoost: number;
  semanticDensityBoost: number;
  finalScore: number;
  retrievalReasons: string[];
  deduplicationDecision: DeduplicationDecision;
  tokenBudgetDecision: TokenBudgetDecision;
  rankingRank: number;
}

export interface RankingBreakdown {
  memoryId: string;
  chunkId: string;
  semanticSimilarity: number;
  importanceBoost: number;
  recencyBoost: number;
  reinforcementBoost: number;
  semanticDensityBoost: number;
  finalScore: number;
  weights: RankingWeightsSnapshot;
  rankingRank: number;
}

export interface RankingWeightsSnapshot {
  importance: number;
  recency: number;
  reinforcement: number;
  semanticDensity: number;
}

export type RejectionReason =
  | "below_similarity_threshold"
  | "scope_filter"
  | "deduplication_overlap"
  | "token_budget_trim"
  | "missing_embedding"
  | "archived_or_ineligible";

export interface RejectedCandidate {
  memoryId: string;
  chunkId: string;
  reason: RejectionReason;
  detail: string;
  semanticSimilarity?: number;
  finalScore?: number;
}

export interface ContextPackage {
  query: string;
  workspaceId: string;
  retrievalTraceId: string;
  tokenBudget: RetrievalTokenBudget;
  retrievalMetadata: RetrievalPipelineMetadata;
  memories: RetrievedMemory[];
  rejectedCandidates: RejectedCandidate[];
  rankingBreakdown: RankingBreakdown[];
  chunkTraces: ChunkRetrievalTrace[];
  generatedAt: string;
  /** Domain Engine — execution context and fact override trace (Phase 4) */
  domainMetadata?: import("./domain-engine-contracts.js").DomainContextMetadata;
  /** Observation System — normalized metrics scoped by domain observationFilters */
  observations?: import("./observation-contracts.js").NormalizedObservation[];
}

export interface RetrievalStageRecord {
  stage: string;
  status: "started" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface RetrievalTraceView {
  retrievalTraceId: string;
  workspaceId: string;
  query: string;
  status: "pending" | "processing" | "completed" | "failed";
  retrievalMode: RetrievalMode;
  tokenBudget: number;
  stages: RetrievalStageRecord[];
  timingAudit?: ExecutionTimingAudit;
  llmCallAudit?: LlmCallAudit;
  dbObservability?: RetrievalDbObservability;
  contextPackage?: ContextPackage;
  preprocessedQuery?: PreprocessedQuery;
  executionContext?: import("./domain-engine-contracts.js").DomainExecutionContext;
  factOverrides?: import("./domain-engine-contracts.js").FactOverrideRecord[];
  createdAt: string;
  completedAt?: string;
}

export interface PreprocessedQuery {
  normalizedQuery: string;
  keywords: string[];
  tokenCount: number;
  /** Deterministic operational concepts extracted from query structure */
  operationalConcepts?: string[];
  /** Matched operational domain labels */
  domains?: string[];
  /** Text used for query embedding (may include retrieval anchors) */
  embeddingText?: string;
}

export interface RetrievalHeatmapEntry {
  memoryId: string;
  accessCount: number;
  averageRank: number;
  averageScore: number;
}

export const RETRIEVAL_EVENT_TYPES = {
  RETRIEVAL_STARTED: "retrieval.started",
  PREPROCESSING_COMPLETED: "retrieval.preprocessing.completed",
  VECTOR_RETRIEVAL_COMPLETED: "retrieval.vector.completed",
  RERANKING_COMPLETED: "retrieval.reranking.completed",
  DEDUPLICATION_COMPLETED: "retrieval.deduplication.completed",
  TOKEN_BUDGETING_COMPLETED: "retrieval.token_budgeting.completed",
  CONTEXT_ASSEMBLY_COMPLETED: "retrieval.context_assembly.completed",
  RETRIEVAL_COMPLETED: "retrieval.completed",
  RETRIEVAL_FAILED: "retrieval.failed",
} as const;

export type RetrievalEventType =
  (typeof RETRIEVAL_EVENT_TYPES)[keyof typeof RETRIEVAL_EVENT_TYPES];

export interface RetrievalRankingConfig {
  importance: number;
  recency: number;
  reinforcement: number;
  semanticDensity: number;
}

export interface RetrievalVectorConfig {
  similarityThreshold: number;
  topKPrecision: number;
  topKExpanded: number;
  topKExploratory: number;
  topKIncidentResponse: number;
}

export interface RetrievalDeduplicationConfig {
  overlapThreshold: number;
}

export interface RetrievalRuntimeConfig {
  ranking: RetrievalRankingConfig;
  vector: RetrievalVectorConfig;
  deduplication: RetrievalDeduplicationConfig;
}

export const DEFAULT_RETRIEVAL_RUNTIME_CONFIG: RetrievalRuntimeConfig = {
  ranking: {
    importance: 0.12,
    recency: 0.08,
    reinforcement: 0.06,
    semanticDensity: 0.05,
  },
  vector: {
    similarityThreshold: 0.55,
    topKPrecision: 24,
    topKExpanded: 48,
    topKExploratory: 42,
    topKIncidentResponse: 30,
  },
  deduplication: {
    overlapThreshold: 0.62,
  },
};
