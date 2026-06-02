export type MemoryRelationshipType =
  | "same_lineage"
  | "chunk_adjacency"
  | "semantic_overlap"
  | "co_retrieval"
  | "semantic_similarity"
  | "structural_adjacency"
  | "metadata_overlap"
  | "retrieval_cooccurrence"
  | "operational_association";

export interface RelationshipGraphNode {
  id: string;
  label: string;
  memoryType: string;
  sourceType: string;
  domain: string;
  accessCount: number;
  averageRank: number;
  averageScore: number;
  reinforcementScore: number;
  semanticDensity: number;
  rankingInfluence: number;
  archived: boolean;
  retrievalEligible: boolean;
  clusterId: string;
  chunkCount: number;
  createdAt: string;
}

export interface RelationshipGraphEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: MemoryRelationshipType;
  weight: number;
  confidence: number;
  origin: string;
  metadataOverlap: number;
  semanticOverlap: number;
  retrievalCoOccurrence: number;
  compressionTraceId?: string;
  createdAt: string;
}

export interface DomainCluster {
  id: string;
  label: string;
  domain: string;
  nodeCount: number;
  avgWeight: number;
}

export interface GraphTimelineEvent {
  id: string;
  timestamp: string;
  eventType:
    | "relationship_created"
    | "relationship_updated"
    | "reinforcement"
    | "archival"
    | "retrieval"
    | "compression";
  memoryIds: string[];
  detail: string;
  weight?: number;
  traceId?: string;
}

export interface GraphRetrievalTrace {
  retrievalTraceId: string;
  query: string;
  createdAt: string;
  memoryIds: string[];
  rankingOrder: string[];
}

export interface RelationshipGraphView {
  workspaceId: string;
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
  domains: DomainCluster[];
  timelineEvents: GraphTimelineEvent[];
  retrievalTraces: GraphRetrievalTrace[];
  stats: {
    nodeCount: number;
    edgeCount: number;
    clusterCount: number;
    avgConfidence: number;
  };
}

export interface SimNode extends RelationshipGraphNode {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
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

export interface MemoryDetail {
  memory: {
    id: string;
    title: string;
    sourceType: string;
    memoryType: string;
    normalizedContent: string;
    metadata: Record<string, unknown>;
    scoring: Record<string, unknown>;
    observability: {
      chunkCount: number;
      tokenCount: number;
      retrievalEligible: boolean;
      archived: boolean;
    };
    chunks: Array<{
      id: string;
      tokenCount: number;
      metadata: Record<string, unknown>;
    }>;
  };
}
