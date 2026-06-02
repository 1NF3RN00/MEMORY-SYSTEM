import type { PrismaClient } from "@prisma/client";
import type { RelationshipType } from "@memory-middleware/shared-types";
import { buildRetrievalHeatmap } from "./retrieval-store.js";

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
  relationshipType: RelationshipType;
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

const RELATIONSHIP_ORIGINS: Record<string, string> = {
  same_lineage: "Lineage derivation — shared ingestion trace",
  chunk_adjacency: "Structural adjacency — sequential chunk linkage",
  semantic_overlap: "Semantic overlap — token Jaccard similarity",
  co_retrieval: "Co-retrieval — joint context assembly",
  semantic_similarity: "Semantic similarity — token Jaccard overlap across memories",
  structural_adjacency: "Structural adjacency — contextual proximity",
  metadata_overlap: "Metadata overlap — shared tags, domains, or lineage",
  retrieval_cooccurrence: "Retrieval co-occurrence — joint retrieval frequency",
  operational_association: "Operational association — shared domain grouping",
};

function deriveDomain(memoryType: string, sourceType: string): string {
  if (memoryType && memoryType !== "generic") return memoryType;
  if (sourceType && sourceType !== "unknown") return sourceType;
  return "operational";
}

function extractExplainability(
  relationshipType: RelationshipType,
  weight: number,
  metadata: Record<string, unknown>,
): Pick<
  RelationshipGraphEdge,
  "confidence" | "origin" | "metadataOverlap" | "semanticOverlap" | "retrievalCoOccurrence"
> {
  const normalized = relationshipType.replace(/-/g, "_");
  const metaOverlap = Number(metadata.metadataOverlap ?? metadata.metadata_overlap ?? 0);
  const semOverlap = Number(
    metadata.semanticOverlap ??
      metadata.semantic_overlap ??
      metadata.overlapScore ??
      (normalized.includes("semantic") ? weight : 0),
  );
  const coOccurrence = Number(
    metadata.retrievalCoOccurrence ??
      metadata.co_retrieval_count ??
      metadata.coOccurrenceCount ??
      (normalized.includes("co") || normalized.includes("retrieval") ? weight : 0),
  );

  const confidence =
    normalized.includes("semantic")
      ? Math.min(1, weight * 0.6 + semOverlap * 0.4)
      : normalized.includes("co") || normalized === "retrieval_cooccurrence"
        ? Math.min(1, weight * 0.5 + coOccurrence * 0.5)
        : normalized.includes("lineage") || normalized === "metadata_overlap"
          ? Math.min(1, weight * 0.85 + metaOverlap * 0.15)
          : Math.min(1, weight);

  return {
    confidence,
    origin: RELATIONSHIP_ORIGINS[relationshipType] ?? "Deterministic relationship derivation",
    metadataOverlap: metaOverlap,
    semanticOverlap: semOverlap,
    retrievalCoOccurrence: coOccurrence,
  };
}

export async function getWorkspaceRelationshipGraph(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<RelationshipGraphView | null> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace) return null;

  const [relationships, memories, heatmapEntries, retrievalOps, compressionOps] =
    await Promise.all([
      prisma.memoryRelationship.findMany({
        where: { workspaceId },
        orderBy: { weight: "desc" },
      }),
      prisma.memory.findMany({
        where: { workspaceId, archived: false },
        include: { chunks: { select: { id: true, metadata: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      buildRetrievalHeatmap(prisma, workspaceId, 200),
      prisma.retrievalOperation.findMany({
        where: { workspaceId, status: "completed" },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.compressionOperation.findMany({
        where: { workspaceId, status: "completed" },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

  const heatmapByMemory = new Map(
    heatmapEntries.map((e) => [e.memoryId, e]),
  );

  const memoryIdsInGraph = new Set<string>();
  for (const rel of relationships) {
    memoryIdsInGraph.add(rel.sourceMemoryId);
    memoryIdsInGraph.add(rel.targetMemoryId);
  }
  for (const m of memories) {
    memoryIdsInGraph.add(m.id);
  }

  const memoryById = new Map(memories.map((m) => [m.id, m]));

  const nodes: RelationshipGraphNode[] = [...memoryIdsInGraph].map((id) => {
    const memory = memoryById.get(id);
    const heat = heatmapByMemory.get(id);
    const scoring = (memory?.scoring ?? {}) as Record<string, unknown>;
    const metadata = (memory?.metadata ?? {}) as Record<string, unknown>;

    let semanticDensity = 0;
    let rankingInfluence = 0;
    if (memory?.chunks.length) {
      for (const chunk of memory.chunks) {
        const chunkMeta = (chunk.metadata ?? {}) as Record<string, unknown>;
        const densityDetail = chunkMeta.densityDetail as
          | { combinedScore?: number; rankingInfluence?: number }
          | undefined;
        semanticDensity += densityDetail?.combinedScore ?? 0;
        rankingInfluence += densityDetail?.rankingInfluence ?? 0;
      }
      semanticDensity /= memory.chunks.length;
      rankingInfluence /= memory.chunks.length;
    }

    const memoryType = memory?.memoryType ?? "unknown";
    const sourceType = memory?.sourceType ?? "unknown";
    const domain = deriveDomain(memoryType, sourceType);

    return {
      id,
      label: memory?.title ?? id.slice(0, 12),
      memoryType,
      sourceType,
      domain,
      accessCount: heat?.accessCount ?? 0,
      averageRank: heat?.averageRank ?? 0,
      averageScore: heat?.averageScore ?? 0,
      reinforcementScore: Number(scoring.reinforcementScore ?? 0),
      semanticDensity,
      rankingInfluence,
      archived: memory?.archived ?? false,
      retrievalEligible: memory?.retrievalEligible ?? true,
      clusterId: domain,
      chunkCount: memory?.chunks.length ?? 0,
      createdAt: memory?.createdAt.toISOString() ?? new Date().toISOString(),
    };
  });

  const edges: RelationshipGraphEdge[] = relationships
    .filter(
      (rel) =>
        rel.sourceMemoryId !== rel.targetMemoryId ||
        rel.relationshipType === "chunk_adjacency",
    )
    .map((rel) => {
      const meta = (rel.metadata ?? {}) as Record<string, unknown>;
      const explain = extractExplainability(
        rel.relationshipType as RelationshipType,
        rel.weight,
        meta,
      );

      return {
        id: rel.id,
        source: rel.sourceMemoryId,
        target: rel.targetMemoryId,
        relationshipType: rel.relationshipType as RelationshipType,
        weight: rel.weight,
        ...explain,
        ...(rel.compressionTraceId ? { compressionTraceId: rel.compressionTraceId } : {}),
        createdAt: rel.createdAt.toISOString(),
      };
    });

  const domainMap = new Map<string, { nodes: string[]; weights: number[] }>();
  for (const node of nodes) {
    const entry = domainMap.get(node.domain) ?? { nodes: [], weights: [] };
    entry.nodes.push(node.id);
    domainMap.set(node.domain, entry);
  }
  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    if (!sourceNode) continue;
    const entry = domainMap.get(sourceNode.domain);
    if (entry) entry.weights.push(edge.weight);
  }

  const domains: DomainCluster[] = [...domainMap.entries()].map(([domain, data]) => ({
    id: domain,
    label: domain.replace(/_/g, " "),
    domain,
    nodeCount: data.nodes.length,
    avgWeight:
      data.weights.length > 0
        ? data.weights.reduce((a, b) => a + b, 0) / data.weights.length
        : 0,
  }));

  const timelineEvents: GraphTimelineEvent[] = [];

  for (const rel of relationships) {
    timelineEvents.push({
      id: `rel-${rel.id}`,
      timestamp: rel.createdAt.toISOString(),
      eventType: "relationship_created",
      memoryIds: [rel.sourceMemoryId, rel.targetMemoryId],
      detail: `${rel.relationshipType} edge formed (w=${rel.weight.toFixed(2)})`,
      weight: rel.weight,
    });
  }

  for (const op of retrievalOps) {
    const result = (op.result ?? {}) as {
      contextPackage?: {
        memories?: Array<{ memoryId: string }>;
        chunkTraces?: Array<{ memoryId: string; rankingRank: number }>;
      };
    };
    const pkg = result.contextPackage;
    if (!pkg?.memories?.length) continue;

    timelineEvents.push({
      id: `ret-${op.traceId}`,
      timestamp: op.createdAt.toISOString(),
      eventType: "retrieval",
      memoryIds: pkg.memories.map((m) => m.memoryId),
      detail: `Retrieval: "${op.query.slice(0, 60)}${op.query.length > 60 ? "…" : ""}"`,
      traceId: op.traceId,
    });
  }

  for (const op of compressionOps) {
    timelineEvents.push({
      id: `cmp-${op.traceId}`,
      timestamp: op.createdAt.toISOString(),
      eventType: "compression",
      memoryIds: [],
      detail: `Compression trace ${op.traceId.slice(0, 10)}…`,
      traceId: op.traceId,
    });
  }

  timelineEvents.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const retrievalTraces: GraphRetrievalTrace[] = retrievalOps
    .map((op) => {
      const result = (op.result ?? {}) as {
        contextPackage?: {
          memories?: Array<{ memoryId: string }>;
          chunkTraces?: Array<{ memoryId: string; rankingRank: number }>;
        };
      };
      const pkg = result.contextPackage;
      if (!pkg?.memories?.length) return null;

      const rankingOrder = [...(pkg.chunkTraces ?? [])]
        .sort((a, b) => a.rankingRank - b.rankingRank)
        .map((t) => t.memoryId);

      return {
        retrievalTraceId: op.traceId,
        query: op.query,
        createdAt: op.createdAt.toISOString(),
        memoryIds: [...new Set(pkg.memories.map((m) => m.memoryId))],
        rankingOrder: [...new Set(rankingOrder)],
      };
    })
    .filter((t): t is GraphRetrievalTrace => t !== null);

  const avgConfidence =
    edges.length > 0
      ? edges.reduce((sum, e) => sum + e.confidence, 0) / edges.length
      : 0;

  return {
    workspaceId,
    nodes,
    edges,
    domains,
    timelineEvents,
    retrievalTraces,
    stats: {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      clusterCount: domains.length,
      avgConfidence,
    },
  };
}
