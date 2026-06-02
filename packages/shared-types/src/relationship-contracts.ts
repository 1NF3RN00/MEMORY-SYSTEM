/**
 * Sprint 7 — relationship layer and retrieval augmentation contracts.
 * Semantic precision remains dominant; relationships augment, never override.
 */

/** V1 canonical relationship types (Sprint 7). */
export type SprintRelationshipType =
  | "semantic_similarity"
  | "structural_adjacency"
  | "metadata_overlap"
  | "retrieval_cooccurrence"
  | "operational_association";

/** Legacy Sprint 3 relationship types — preserved for backward compatibility. */
export type LegacyRelationshipType =
  | "same_lineage"
  | "chunk_adjacency"
  | "semantic_overlap"
  | "co_retrieval";

export type RelationshipType = SprintRelationshipType | LegacyRelationshipType;

export interface ConfidenceReasoning {
  semanticOverlap: number;
  metadataOverlap: number;
  structuralAdjacency: number;
  retrievalCoOccurrence: number;
  operationalDomainOverlap: number;
  /** Human-readable deterministic explanation. */
  explanation: string;
}

export interface RelationshipEvolutionEntry {
  timestamp: string;
  event: "generated" | "reinforced" | "co_occurrence" | "usage";
  previousConfidence: number;
  newConfidence: number;
  previousWeight: number;
  newWeight: number;
  reason: string;
}

/** Authoritative Sprint 7 relationship shape — optimized for visualization and inspection. */
export interface EnhancedMemoryRelationship {
  relationshipId: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: RelationshipType;
  confidence: number;
  weight: number;
  generatedFrom: string[];
  reinforcementScore?: number;
  retrievalFrequency?: number;
  confidenceReasoning: ConfidenceReasoning;
  evolutionHistory: RelationshipEvolutionEntry[];
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RelationshipAugmentationConfig {
  /** V1 hard limit — no recursive traversal. */
  maxDepth: 1;
  maxNeighbors: number;
  confidenceThreshold: number;
  /** Max ranking nudge — must remain subordinate to semantic similarity. */
  augmentationWeight: number;
}

export interface RelationshipNeighborSuggestion {
  memoryId: string;
  relationshipType: RelationshipType;
  confidence: number;
  generatedFrom: string[];
  /** Whether this neighbor was already in ranked candidates. */
  inCandidateSet: boolean;
  /** Ranking nudge applied (0 if not in candidate set). */
  rankingImpact: number;
}

export interface RelationshipAugmentationResult {
  neighborsExpanded: RelationshipNeighborSuggestion[];
  rankingImpacts: Array<{
    memoryId: string;
    chunkId: string;
    previousScore: number;
    augmentedScore: number;
    relationshipType: RelationshipType;
    confidence: number;
  }>;
  augmentationApplied: boolean;
  maxDepth: 1;
  neighborCount: number;
  confidenceThreshold: number;
  /** Deterministic explanation of augmentation decisions. */
  reasoning: string[];
}

export interface NeighborhoodNode {
  memoryId: string;
  label: string;
  memoryType: string;
  domain: string;
  confidence: number;
  relationshipType: RelationshipType;
  generatedFrom: string[];
  /** Distance from anchor — V1 max 1. */
  depth: number;
}

export interface NeighborhoodView {
  anchorMemoryId: string;
  workspaceId: string;
  nodes: NeighborhoodNode[];
  edges: Array<{
    source: string;
    target: string;
    relationshipType: RelationshipType;
    confidence: number;
    weight: number;
    generatedFrom: string[];
  }>;
  semanticNeighborhood: string[];
  operationalCluster: string;
  reasoning: string[];
  generatedAt: string;
}

export interface OperationalCluster {
  clusterId: string;
  label: string;
  domain: string;
  memoryIds: string[];
  nodeCount: number;
  avgConfidence: number;
  avgWeight: number;
  relationshipDensity: number;
}

export interface ClusterView {
  workspaceId: string;
  clusters: OperationalCluster[];
  stats: {
    clusterCount: number;
    totalMemories: number;
    avgClusterSize: number;
  };
  generatedAt: string;
}

export interface AugmentationTraceView {
  retrievalTraceId: string;
  workspaceId: string;
  query: string;
  augmentation: RelationshipAugmentationResult;
  /** Combined with structural expansion when present. */
  structuralExpansion?: {
    metadataExpansion: {
      expandedTags: string[];
      matchedMetadataKeys: string[];
      enrichmentScore: number;
    };
    contextualNeighborCount: number;
  };
  retrievedMemoryIds: string[];
  augmentedMemoryIds: string[];
  reasoning: string[];
  createdAt: string;
}

export interface RelationshipGenerationRequest {
  workspaceId: string;
  /** When set, generate only for this memory; otherwise workspace-wide. */
  memoryId?: string;
  /** Sources to include — all when omitted. */
  sources?: Array<
    | "semantic_similarity"
    | "structural_adjacency"
    | "metadata_overlap"
    | "retrieval_cooccurrence"
    | "operational_domain_overlap"
  >;
  confidenceThreshold?: number;
}

export interface RelationshipGenerationResult {
  workspaceId: string;
  generated: number;
  updated: number;
  relationships: EnhancedMemoryRelationship[];
  reasoning: string[];
}

export interface EnhancedMemoryRelationshipView {
  memoryId: string;
  workspaceId: string;
  relationships: EnhancedMemoryRelationship[];
  adjacencyHints: import("./compression-contracts.js").AdjacencyHint[];
}

export const RELATIONSHIP_EVENT_TYPES = {
  RELATIONSHIP_GENERATED: "relationship.generated",
  RELATIONSHIP_UPDATED: "relationship.updated",
  RELATIONSHIP_REINFORCED: "relationship.reinforced",
  AUGMENTATION_APPLIED: "relationship.augmentation.applied",
  NEIGHBORHOOD_EXPANDED: "relationship.neighborhood.expanded",
  CLUSTER_GENERATED: "relationship.cluster.generated",
} as const;

export type RelationshipEventType =
  (typeof RELATIONSHIP_EVENT_TYPES)[keyof typeof RELATIONSHIP_EVENT_TYPES];

export const DEFAULT_RELATIONSHIP_AUGMENTATION_CONFIG: RelationshipAugmentationConfig = {
  maxDepth: 1,
  maxNeighbors: 8,
  confidenceThreshold: 0.55,
  augmentationWeight: 0.04,
};

/** Map legacy relationship types to Sprint 7 canonical types. */
export const LEGACY_TYPE_MAP: Record<LegacyRelationshipType, SprintRelationshipType> = {
  semantic_overlap: "semantic_similarity",
  chunk_adjacency: "structural_adjacency",
  co_retrieval: "retrieval_cooccurrence",
  same_lineage: "metadata_overlap",
};

export function normalizeRelationshipType(type: RelationshipType): SprintRelationshipType {
  if (type in LEGACY_TYPE_MAP) {
    return LEGACY_TYPE_MAP[type as LegacyRelationshipType];
  }
  return type as SprintRelationshipType;
}
