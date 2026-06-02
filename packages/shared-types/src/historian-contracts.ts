/**
 * Sprint 5 operational historian + replay contracts.
 */

import type {
  CompressionStageTrace,
  FidelityReport,
  MergeDecision,
  OptimizedContextPackage,
  TrimmingDecision,
} from "./compression-contracts.js";
import type { HistorianDeliveryArtifact } from "./context-delivery-contracts.js";
import type {
  ContextPackage,
  PreprocessedQuery,
  RankingBreakdown,
  RetrievalMode,
  RetrievalStageRecord,
} from "./retrieval-contracts.js";

export type ReplayStageName =
  | "preprocessing"
  | "vector_retrieval"
  | "reranking"
  | "deduplication"
  | "compression"
  | "context_assembly"
  | "context_delivery";

export interface ReplayStage {
  stage: ReplayStageName;
  inputs: unknown;
  outputs: unknown;
  latencyMs: number;
  timestamp: string;
}

export interface HistorianCompressionArtifact {
  compressionTraceId: string;
  retrievalTraceId: string;
  fidelityMode: string;
  mergeDecisions: MergeDecision[];
  trimmingDecisions: TrimmingDecision[];
  stageTraces: CompressionStageTrace[];
  fidelityReport?: FidelityReport;
  optimizedContextPackage?: OptimizedContextPackage;
}

export interface ReplaySnapshot {
  replayId: string;
  retrievalTraceId: string;
  workspaceId: string;
  originalQuery: string;
  retrievalMode: RetrievalMode;
  tokenBudget: number;
  stages: ReplayStage[];
  contextPackage: ContextPackage;
  compressionArtifacts: HistorianCompressionArtifact[];
  deliveryArtifacts: HistorianDeliveryArtifact[];
  rankingBreakdowns: RankingBreakdown[];
  preprocessedQuery?: PreprocessedQuery;
  integrityHash: string;
  replayTimestamp: string;
}

export type ReplayMode = "exact" | "stage";

export interface ReplayResult {
  replayId: string;
  retrievalTraceId: string;
  mode: ReplayMode;
  snapshot: ReplaySnapshot;
  integrityValid: boolean;
  reconstructedStages: ReplayStage[];
  replayedAt: string;
}

export interface BenchmarkReplayRequest {
  workspaceId: string;
  retrievalTraceId: string;
  /** Re-run retrieval with optional runtime overrides */
  rerunRetrieval?: boolean;
  /** Re-run compression against benchmark retrieval output */
  rerunCompression?: boolean;
  retrievalConfigOverrides?: Record<string, unknown>;
  compressionOverrides?: {
    fidelityMode?: string;
    nuancePreservation?: number;
    tokenOptimization?: number;
    targetTokenBudget?: number;
  };
}

export interface RankingComparisonEntry {
  chunkId: string;
  memoryId: string;
  originalRank: number | null;
  benchmarkRank: number | null;
  rankDelta: number | null;
  originalScore: number | null;
  benchmarkScore: number | null;
  scoreDelta: number | null;
}

export interface BenchmarkComparisonResult {
  benchmarkId: string;
  retrievalTraceId: string;
  workspaceId: string;
  originalSnapshot: ReplaySnapshot;
  benchmarkContextPackage?: ContextPackage;
  benchmarkOptimizedPackage?: OptimizedContextPackage;
  rankingComparison: RankingComparisonEntry[];
  tokenEfficiency: {
    originalUsedTokens: number;
    benchmarkUsedTokens: number;
    tokenDelta: number;
    originalTrimmedTokens: number;
    benchmarkTrimmedTokens: number;
  };
  compressionComparison?: {
    originalFidelityScore: number | null;
    benchmarkFidelityScore: number | null;
    originalTokenSavings: number | null;
    benchmarkTokenSavings: number | null;
    mergeCountDelta: number;
    trimCountDelta: number;
  };
  chunkingComparison: {
    originalChunkCount: number;
    benchmarkChunkCount: number;
    chunkCountDelta: number;
  };
  executedAt: string;
}

export type DriftSignalType =
  | "ranking_instability"
  | "token_inflation"
  | "compression_aggressiveness"
  | "retrieval_precision_degradation"
  | "reinforcement_bias";

export interface DriftSignal {
  signalType: DriftSignalType;
  severity: "low" | "medium" | "high";
  workspaceId: string;
  retrievalTraceId?: string;
  replayId?: string;
  metric: string;
  baselineValue: number;
  observedValue: number;
  delta: number;
  detail: string;
  detectedAt: string;
}

export interface DriftDetectionReport {
  workspaceId: string;
  signals: DriftSignal[];
  analyzedTraceCount: number;
  generatedAt: string;
}

export interface TokenInflationEntry {
  retrievalTraceId: string;
  query: string;
  baselineUsedTokens: number;
  observedUsedTokens: number;
  inflationRatio: number;
  trimmedTokens: number;
  createdAt: string;
}

export interface TokenInflationReport {
  workspaceId: string;
  baselineAverageTokens: number;
  entries: TokenInflationEntry[];
  generatedAt: string;
}

export interface FailedRetrievalDiagnostic {
  retrievalTraceId: string;
  query: string;
  error?: string;
  failedStage?: string;
  createdAt: string;
}

export interface LowConfidenceRetrievalDiagnostic {
  retrievalTraceId: string;
  query: string;
  topScore: number;
  includedChunkCount: number;
  rejectedCount: number;
  createdAt: string;
}

export interface TokenWasteDiagnostic {
  retrievalTraceId: string;
  query: string;
  trimmedTokens: number;
  rejectedByBudget: number;
  deduplicationRemoved: number;
  createdAt: string;
}

export interface ContextualDegradationDiagnostic {
  retrievalTraceId: string;
  query: string;
  fidelityScore?: number;
  compressionAggressiveness?: number;
  rankingPreservationRatio?: number;
  createdAt: string;
}

export interface OperationalDiagnosticsReport {
  workspaceId: string;
  failedRetrievals: FailedRetrievalDiagnostic[];
  lowConfidenceRetrievals: LowConfidenceRetrievalDiagnostic[];
  tokenWaste: TokenWasteDiagnostic[];
  contextualDegradation: ContextualDegradationDiagnostic[];
  generatedAt: string;
}

export type RetentionMode =
  | "operational"
  | "historical"
  | "compressed_archival"
  | "permanent_deletion";

export interface HistorianRetentionConfig {
  operationalRetentionDays: number;
  historicalRetentionDays: number;
  compressedArchivalDays: number;
  autoArchiveEnabled: boolean;
}

export const DEFAULT_HISTORIAN_RETENTION_CONFIG: HistorianRetentionConfig = {
  operationalRetentionDays: 30,
  historicalRetentionDays: 365,
  compressedArchivalDays: 730,
  autoArchiveEnabled: true,
};

export interface RetentionArchiveResult {
  archivedCount: number;
  archivedReplayIds: string[];
  retentionMode: RetentionMode;
  executedAt: string;
}

export interface PermanentDeletionResult {
  deletedId: string;
  idType: "replay" | "retrieval_trace";
  workspaceId: string;
  removedReplaySnapshots: number;
  removedRetrievalOperations: number;
  removedCompressionOperations: number;
  removedEventLogs: number;
  deletedAt: string;
}

export interface MemoryHistoryTimeline {
  memoryId: string;
  workspaceId: string;
  reinforcementProgression: Array<{
    timestamp: string;
    reinforcementScore: number;
    retrievalCount: number;
    traceId?: string;
  }>;
  decayProgression: Array<{
    timestamp: string;
    recencyScore: number;
    relevanceScore: number;
  }>;
  archivalHistory: Array<{
    timestamp: string;
    action: string;
    detail: string;
  }>;
  retrievalFrequency: Array<{
    retrievalTraceId: string;
    query: string;
    rank: number | null;
    timestamp: string;
  }>;
}

export const HISTORIAN_EVENT_TYPES = {
  REPLAY_STARTED: "historian.replay.started",
  REPLAY_COMPLETED: "historian.replay.completed",
  BENCHMARK_EXECUTED: "historian.benchmark.executed",
  DRIFT_DETECTED: "historian.drift.detected",
  RETENTION_ARCHIVED: "historian.retention.archived",
  PERMANENT_DELETION_EXECUTED: "historian.permanent_deletion.executed",
} as const;

export type HistorianEventType =
  (typeof HISTORIAN_EVENT_TYPES)[keyof typeof HISTORIAN_EVENT_TYPES];
