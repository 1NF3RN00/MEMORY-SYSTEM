/**
 * Sprint 4 — structural intelligence and memory evolution contracts.
 */

/** Contextual adjacency lineage stored on each chunk. */
export interface ChunkLineage {
  parentChunkId?: string;
  previousChunkId?: string;
  nextChunkId?: string;
  sectionPath: string[];
  headingHierarchy: string[];
  semanticGroupId?: string;
  siblingChunkIds?: string[];
}

/** Explainability for structural segmentation decisions. */
export interface StructuralSegmentationReason {
  chunkIndex: number;
  strategy: string;
  headingInheritance: string[];
  semanticGroupId?: string;
  boundaryReason: string;
  preservedBulletGroup: boolean;
}

/** Result of structure-aware chunking. */
export interface StructuralChunkResult {
  chunks: Array<{
    chunkId: string;
    content: string;
    tokenCount: number;
    lineage: ChunkLineage;
    segmentationReason: StructuralSegmentationReason;
    semanticDensityScore: number;
    densityDetail: SemanticDensityDetail;
  }>;
  strategy: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  segmentationReasons: StructuralSegmentationReason[];
  structureParseLatencyMs: number;
}

/** Semantic density breakdown per chunk. */
export interface SemanticDensityDetail {
  informationalConcentration: number;
  contextualUniqueness: number;
  combinedScore: number;
  rankingInfluence: number;
}

/** Operational memory evolution state. */
export interface MemoryEvolution {
  reinforcementScore: number;
  recencyScore: number;
  archivalScore: number;
  retrievalFrequency: number;
  lastRetrievedAt?: string;
  lastReinforcedAt?: string;
  archivalEligible: boolean;
  archivalReason?: string;
}

/** Single evolution history entry for observability. */
export interface EvolutionHistoryEntry {
  timestamp: string;
  event: string;
  previousValues: Partial<MemoryEvolution>;
  newValues: Partial<MemoryEvolution>;
  reason: string;
}

/** Memory structure view for GET /memory/:id/structure */
export interface MemoryStructureView {
  memoryId: string;
  chunkingStrategy: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  headingHierarchy: string[];
  chunks: Array<{
    chunkId: string;
    chunkIndex: number;
    content: string;
    tokenCount: number;
    semanticDensityScore: number;
    densityDetail: SemanticDensityDetail;
    lineage: ChunkLineage;
    segmentationReason: StructuralSegmentationReason;
  }>;
  segmentationReasons: StructuralSegmentationReason[];
}

/** Memory evolution view for GET /memory/:id/evolution */
export interface MemoryEvolutionView {
  memoryId: string;
  evolution: MemoryEvolution;
  scoring: {
    importanceScore: number;
    reinforcementScore: number;
    semanticDensityScore: number;
    retrievalCount: number;
    archivalScore: number;
  };
  history: EvolutionHistoryEntry[];
  decayExplanation: {
    recencyScore: number;
    daysSinceLastRetrieval: number;
    decayWeight: number;
    formula: string;
  };
  archivalExplanation: {
    archivalEligible: boolean;
    archivalScore: number;
    threshold: number;
    reason: string;
  };
}

/** Adjacency view for GET /memory/:id/adjacency */
export interface MemoryAdjacencyView {
  memoryId: string;
  adjacencyGraph: Array<{
    chunkId: string;
    chunkIndex: number;
    previousChunkId?: string;
    nextChunkId?: string;
    siblingChunkIds: string[];
    sectionPath: string[];
    headingHierarchy: string[];
    semanticGroupId?: string;
  }>;
  sectionHierarchy: Array<{
    path: string[];
    chunkIds: string[];
  }>;
}

/** Reinforce request/response */
export interface MemoryReinforceRequest {
  reason?: string;
  contextualUsefulness?: number;
}

export interface MemoryReinforceResponse {
  memoryId: string;
  evolution: MemoryEvolution;
  reinforcementDelta: number;
  message: string;
}

/** Deterministic semantic surface extracted during ingestion — no LLM generation. */
export interface SemanticSurface {
  primaryConcepts: string[];
  operationalDomains: string[];
  semanticAliases: string[];
  contextualKeywords: string[];
  hierarchyPath?: string[];
}

/** Lightweight retrieval surface attached to chunks for matching without payload bloat. */
export interface ChunkRetrievalSurface {
  semanticHeader: string;
  retrievalTags: string[];
  contextualDescriptors: string[];
  semanticSurface: SemanticSurface;
}

/** Retrieval expansion result. */
export interface RetrievalExpansionResult {
  metadataExpansion: {
    expandedTags: string[];
    matchedMetadataKeys: string[];
    enrichmentScore: number;
    /** Deterministic expansion terms from semantic surfaces and hierarchy. */
    surfaceExpansionTerms?: string[];
  };
  contextualNeighbors: ContextualNeighborHint[];
  expansionApplied: boolean;
}

/** Contextual neighbor hint for retrieval augmentation. */
export interface ContextualNeighborHint {
  sourceChunkId: string;
  neighborChunkId: string;
  relationship: "previous" | "next" | "sibling" | "section";
  hintWeight: number;
  sectionPath: string[];
}

export const STRUCTURAL_CHUNKING_STRATEGY = "structure-aware-v1" as const;
export const DETERMINISTIC_FALLBACK_STRATEGY = "deterministic-fixed-v1" as const;

export const STRUCTURAL_EVENT_TYPES = {
  STRUCTURE_PARSING_COMPLETED: "structural.parsing.completed",
  SEMANTIC_SEGMENTATION_COMPLETED: "structural.segmentation.completed",
  ADJACENCY_GENERATION_COMPLETED: "structural.adjacency.completed",
  SEMANTIC_DENSITY_SCORED: "structural.density.scored",
  STRUCTURAL_FALLBACK: "structural.fallback",
} as const;

export type StructuralEventType =
  (typeof STRUCTURAL_EVENT_TYPES)[keyof typeof STRUCTURAL_EVENT_TYPES];

export const EVOLUTION_EVENT_TYPES = {
  REINFORCEMENT_UPDATED: "evolution.reinforcement.updated",
  DECAY_UPDATED: "evolution.decay.updated",
  ARCHIVAL_TRANSITIONED: "evolution.archival.transitioned",
  RETRIEVAL_EXPANSION_APPLIED: "retrieval.expansion.applied",
} as const;

export type EvolutionEventType =
  (typeof EVOLUTION_EVENT_TYPES)[keyof typeof EVOLUTION_EVENT_TYPES];

/** Configurable evolution parameters. */
export interface EvolutionConfig {
  recencyHalfLifeDays: number;
  recencyWeight: number;
  reinforcementIncrement: number;
  reinforcementMax: number;
  archivalThreshold: number;
  archivalMinRetrievalFrequency: number;
  staleDaysThreshold: number;
}

export const DEFAULT_EVOLUTION_CONFIG: EvolutionConfig = {
  recencyHalfLifeDays: 90,
  recencyWeight: 1,
  reinforcementIncrement: 0.05,
  reinforcementMax: 1,
  archivalThreshold: 0.85,
  archivalMinRetrievalFrequency: 2,
  staleDaysThreshold: 365,
};
