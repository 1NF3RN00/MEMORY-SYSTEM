import type {
  EnhancedMemoryRelationship,
  NeighborhoodNode,
  NeighborhoodView,
} from "@memory-middleware/shared-types";

export interface StoredRelationshipRow {
  relationshipId: string;
  sourceMemoryId: string;
  targetMemoryId: string;
  relationshipType: EnhancedMemoryRelationship["relationshipType"];
  confidence: number;
  weight: number;
  generatedFrom: string[];
  metadata?: Record<string, unknown>;
}

export interface MemoryLabelLookup {
  memoryId: string;
  label: string;
  memoryType: string;
  domain: string;
}

/** Build bounded depth-1 contextual neighborhood for visualization and inspection. */
export function buildNeighborhood(
  anchorMemoryId: string,
  workspaceId: string,
  relationships: StoredRelationshipRow[],
  memoryLookup: Map<string, MemoryLabelLookup>,
  options: { confidenceThreshold?: number; maxNeighbors?: number } = {},
): NeighborhoodView {
  const threshold = options.confidenceThreshold ?? 0.45;
  const maxNeighbors = options.maxNeighbors ?? 12;

  const relevant = relationships
    .filter(
      (r) =>
        (r.sourceMemoryId === anchorMemoryId || r.targetMemoryId === anchorMemoryId) &&
        r.confidence >= threshold &&
        r.sourceMemoryId !== r.targetMemoryId,
    )
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxNeighbors);

  const nodes: NeighborhoodNode[] = [];
  const edges: NeighborhoodView["edges"] = [];
  const reasoning: string[] = [];
  const semanticIds: string[] = [];

  for (const rel of relevant) {
    const neighborId =
      rel.sourceMemoryId === anchorMemoryId ? rel.targetMemoryId : rel.sourceMemoryId;
    const lookup = memoryLookup.get(neighborId);

    nodes.push({
      memoryId: neighborId,
      label: lookup?.label ?? neighborId.slice(0, 12),
      memoryType: lookup?.memoryType ?? "unknown",
      domain: lookup?.domain ?? "operational",
      confidence: rel.confidence,
      relationshipType: rel.relationshipType,
      generatedFrom: rel.generatedFrom,
      depth: 1,
    });

    edges.push({
      source: anchorMemoryId,
      target: neighborId,
      relationshipType: rel.relationshipType,
      confidence: rel.confidence,
      weight: rel.weight,
      generatedFrom: rel.generatedFrom,
    });

    if (
      rel.relationshipType === "semantic_similarity" ||
      rel.relationshipType === "semantic_overlap"
    ) {
      semanticIds.push(neighborId);
    }

    reasoning.push(
      `${rel.relationshipType} → ${neighborId.slice(0, 8)} (conf=${rel.confidence.toFixed(2)}, from: ${rel.generatedFrom.join(", ")})`,
    );
  }

  const domains = nodes.map((n) => n.domain);
  const operationalCluster =
    domains.length > 0
      ? domains.sort((a, b) => domains.filter((d) => d === b).length - domains.filter((d) => d === a).length)[0]!
      : "operational";

  if (nodes.length === 0) {
    reasoning.push("No relationships above confidence threshold — neighborhood empty");
  } else {
    reasoning.unshift(
      `Expanded ${nodes.length} neighbor(s) at depth=1, threshold=${threshold}`,
    );
  }

  return {
    anchorMemoryId,
    workspaceId,
    nodes,
    edges,
    semanticNeighborhood: semanticIds,
    operationalCluster,
    reasoning,
    generatedAt: new Date().toISOString(),
  };
}
