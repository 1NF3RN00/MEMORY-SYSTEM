/**
 * Sprint 3 compression contracts — authoritative API and trace shapes.
 */

import type { ContextPackage } from "./retrieval-contracts.js";

export type FidelityMode = "maximum_fidelity" | "balanced" | "aggressive";

export type CompressionPipelineStage =
  | "overlap_detection"
  | "semantic_merge"
  | "ranking_trim"
  | "abstraction"
  | "fidelity_validation";

export type FidelityImpact = "none" | "low" | "medium" | "high";

export interface CompressionStageTrace {
  compressionStage: CompressionPipelineStage;
  affectedChunks: string[];
  tokenSavings: number;
  fidelityImpact: FidelityImpact;
  compressionReason: string;
  rankingPreservation: boolean;
  llmUsed: boolean;
  metadata?: Record<string, unknown>;
}

export interface CompressionRequest {
  workspaceId: string;
  /** Load context from an existing retrieval trace when contextPackage is omitted. */
  retrievalTraceId?: string;
  contextPackage?: ContextPackage;
  /** Target token budget after compression; defaults to current used tokens if omitted. */
  targetTokenBudget?: number;
  /** Default: maximum_fidelity — retrieval quality dominates token optimization. */
  fidelityMode?: FidelityMode;
  /** 0–1 nuance preservation slider (higher = preserve more nuance). Default 0.85. */
  nuancePreservation?: number;
  /** 0–1 token optimization slider (higher = more aggressive savings). Default 0.3. */
  tokenOptimization?: number;
}

export interface CompressionMetadata {
  fidelityMode: FidelityMode;
  nuancePreservation: number;
  tokenOptimization: number;
  originalTokens: number;
  optimizedTokens: number;
  tokenSavings: number;
  fidelityScore: number;
  abstractionUsed: boolean;
  preprocessingApplied: PreprocessingEnhancementResult;
  stages: CompressionStageTrace[];
}

export interface OptimizedContextPackage extends ContextPackage {
  compressionTraceId: string;
  sourceRetrievalTraceId: string;
  compressionMetadata: CompressionMetadata;
}

export interface CompressionStageRecord {
  stage: string;
  status: "started" | "completed" | "failed";
  startedAt: string;
  completedAt?: string;
  latencyMs?: number;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface FidelityReport {
  fidelityScore: number;
  nuancePreservationScore: number;
  compressionAggressiveness: number;
  retrievalQualityScore: number;
  contextualPreservationScore: number;
  validationPassed: boolean;
  issues: string[];
  rankingPreservationRatio: number;
  chunkRetentionRatio: number;
}

export interface CompressionTraceView {
  compressionTraceId: string;
  workspaceId: string;
  retrievalTraceId: string;
  status: "pending" | "processing" | "completed" | "failed";
  fidelityMode: FidelityMode;
  nuancePreservation: number;
  tokenOptimization: number;
  targetTokenBudget?: number;
  stages: CompressionStageRecord[];
  stageTraces: CompressionStageTrace[];
  originalContextPackage?: ContextPackage;
  optimizedContextPackage?: OptimizedContextPackage;
  fidelityReport?: FidelityReport;
  mergeDecisions?: MergeDecision[];
  trimmingDecisions?: TrimmingDecision[];
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export interface MergeDecision {
  mergedChunkIds: string[];
  resultChunkId: string;
  overlapScore: number;
  preservedRank: number;
  reason: string;
}

export interface TrimmingDecision {
  chunkId: string;
  memoryId: string;
  rankingRank: number;
  finalScore: number;
  tokenCount: number;
  reason: string;
}

export interface OverlapCandidate {
  chunkIdA: string;
  chunkIdB: string;
  memoryIdA: string;
  memoryIdB: string;
  overlapScore: number;
  isDuplicateCandidate: boolean;
  reason: string;
}

export interface QueryHints {
  retrievalHints: string[];
  contextualWeights: Record<string, number>;
  metadataTags: string[];
}

export interface MetadataExpansionResult {
  expandedTags: string[];
  matchedMetadataKeys: string[];
  enrichmentScore: number;
}

export interface PreprocessingEnhancementResult {
  queryHints: QueryHints;
  metadataExpansion: MetadataExpansionResult;
}

export type MemoryRelationshipType =
  | "same_lineage"
  | "chunk_adjacency"
  | "semantic_overlap"
  | "co_retrieval";

export interface MemoryRelationship {
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: MemoryRelationshipType;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface AdjacencyHint {
  chunkId: string;
  adjacentChunkId: string;
  memoryId: string;
  weight: number;
  hintType: "sequential" | "semantic_overlap";
}

export interface MemoryRelationshipView {
  memoryId: string;
  workspaceId: string;
  relationships: MemoryRelationship[];
  adjacencyHints: AdjacencyHint[];
}

export interface CompressionOverlapConfig {
  overlapThreshold: number;
  duplicateThreshold: number;
}

export interface CompressionTrimConfig {
  minRetentionRatio: number;
  rankingWeight: number;
}

export interface CompressionAbstractionConfig {
  enabled: boolean;
  maxAbstractionRatio: number;
}

export interface CompressionRuntimeConfig {
  overlap: CompressionOverlapConfig;
  trim: CompressionTrimConfig;
  abstraction: CompressionAbstractionConfig;
}

export interface CompressionFidelityProfile {
  mode: FidelityMode;
  overlapThreshold: number;
  duplicateThreshold: number;
  minRetentionRatio: number;
  abstractionEnabled: boolean;
  trimAggressiveness: number;
}

export const COMPRESSION_EVENT_TYPES = {
  COMPRESSION_STARTED: "compression.started",
  OVERLAP_DETECTION_COMPLETED: "compression.overlap.completed",
  MERGE_COMPLETED: "compression.merge.completed",
  TRIMMING_COMPLETED: "compression.trim.completed",
  ABSTRACTION_COMPLETED: "compression.abstraction.completed",
  FIDELITY_VALIDATION_COMPLETED: "compression.fidelity.completed",
  COMPRESSION_COMPLETED: "compression.completed",
  COMPRESSION_FAILED: "compression.failed",
} as const;

export type CompressionEventType =
  (typeof COMPRESSION_EVENT_TYPES)[keyof typeof COMPRESSION_EVENT_TYPES];

export const DEFAULT_COMPRESSION_FIDELITY: FidelityMode = "maximum_fidelity";

export const DEFAULT_NUANCE_PRESERVATION = 0.85;
export const DEFAULT_TOKEN_OPTIMIZATION = 0.3;

export const DEFAULT_COMPRESSION_RUNTIME_CONFIG: CompressionRuntimeConfig = {
  overlap: {
    overlapThreshold: 0.78,
    duplicateThreshold: 0.92,
  },
  trim: {
    minRetentionRatio: 0.75,
    rankingWeight: 1.0,
  },
  abstraction: {
    enabled: false,
    maxAbstractionRatio: 0.25,
  },
};
