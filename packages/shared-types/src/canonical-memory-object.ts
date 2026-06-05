/**
 * Canonical Memory Object — V1 authoritative contract (Sprint 1).
 * Append-only, versioned, observable, replayable.
 */

import type { ObservationMetadata } from "./observation-contracts.js";

export type MemoryType =
  | "semantic"
  | "episodic"
  | "procedural"
  | "temporal"
  | "strategic"
  | "observation";

export type PersistenceMode = "persistent" | "temporary";

export type SourceType = "website" | "markdown" | "json" | "text";

export type EmbeddingStatus = "pending" | "completed" | "failed";

export type IngestionState =
  | "pending"
  | "processing"
  | "normalized"
  | "chunked"
  | "embedded"
  | "stored"
  | "completed"
  | "failed"
  | "archived";

export interface CanonicalMemoryMetadata {
  sourceUrl?: string;
  sourceLabel?: string;
  tags?: string[];
  createdAtSource?: string;
  ingestionTimestamp: string;
  embeddingVersion: string;
  normalizationVersion: string;
  /** Sprint 4 — structural chunking metadata */
  structural?: {
    chunkingStrategy: string;
    fallbackUsed: boolean;
    fallbackReason?: string;
  };
  /** Sprint 4 — evolution state persistence */
  evolution?: import("./structural-contracts.js").MemoryEvolution;
  evolutionState?: unknown;
  evolutionHistory?: import("./structural-contracts.js").EvolutionHistoryEntry[];
  /** Observation System — metric metadata when memoryType is observation */
  observation?: ObservationMetadata;
  /** Fast filter for observation memories without parsing observation block */
  isObservation?: boolean;
}

export interface CanonicalMemoryScoring {
  importanceScore: number;
  reinforcementScore: number;
  semanticDensityScore: number;
  retrievalCount: number;
  archivalScore: number;
}

export interface CanonicalMemoryLineage {
  sourceMemoryId?: string;
  derivedFrom?: string[];
  ingestionTraceId: string;
  normalizationTraceId: string;
}

export interface CanonicalMemoryObservability {
  ingestionLatencyMs?: number;
  normalizationLatencyMs?: number;
  embeddingLatencyMs?: number;
  chunkCount: number;
  tokenCount: number;
  retrievalEligible: boolean;
  archived: boolean;
}

export interface CanonicalMemoryChunkMetadata {
  chunkingStrategy: string;
  overlapPrevious?: boolean;
  overlapNext?: boolean;
  /** Sprint 4 — heading inherited from nearest ancestor heading */
  heading?: string;
  /** Sprint 4 — contextual adjacency lineage */
  lineage?: import("./structural-contracts.js").ChunkLineage;
  /** Sprint 4 — segmentation explainability */
  segmentationReason?: import("./structural-contracts.js").StructuralSegmentationReason;
  /** Sprint 4 — density breakdown */
  densityDetail?: import("./structural-contracts.js").SemanticDensityDetail;
  /** Deterministic semantic enrichment for retrieval matching */
  semanticSurface?: import("./structural-contracts.js").SemanticSurface;
  retrievalSurface?: import("./structural-contracts.js").ChunkRetrievalSurface;
}

export interface CanonicalMemoryChunkObservability {
  embeddingLatencyMs?: number;
  retrievalCount: number;
}

export interface CanonicalMemoryChunk {
  id: string;
  memoryId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  embedding?: number[];
  embeddingStatus: EmbeddingStatus;
  semanticDensityScore?: number;
  metadata: CanonicalMemoryChunkMetadata;
  observability: CanonicalMemoryChunkObservability;
  createdAt: string;
}

export interface CanonicalMemoryObject {
  id: string;
  workspaceId: string;
  version: number;
  parentMemoryId?: string;
  memoryType: MemoryType;
  persistenceMode: PersistenceMode;
  sourceType: SourceType;
  title: string;
  normalizedContent: string;
  summary?: string;
  chunks: CanonicalMemoryChunk[];
  metadata: CanonicalMemoryMetadata;
  scoring: CanonicalMemoryScoring;
  lineage: CanonicalMemoryLineage;
  observability: CanonicalMemoryObservability;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
