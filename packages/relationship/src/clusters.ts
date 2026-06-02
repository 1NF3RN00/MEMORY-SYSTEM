import type { ClusterView, OperationalCluster } from "@memory-middleware/shared-types";

export interface ClusterInputNode {
  memoryId: string;
  label: string;
  memoryType: string;
  sourceType: string;
  domain: string;
}

export interface ClusterInputEdge {
  source: string;
  target: string;
  confidence: number;
  weight: number;
}

function deriveDomain(memoryType: string, sourceType: string): string {
  if (memoryType && memoryType !== "generic") return memoryType;
  if (sourceType && sourceType !== "unknown") return sourceType;
  return "operational";
}

/** Build operational clusters from memory domains and relationship density. */
export function buildOperationalClusters(
  workspaceId: string,
  nodes: ClusterInputNode[],
  edges: ClusterInputEdge[],
): ClusterView {
  const domainMap = new Map<string, { memoryIds: string[]; weights: number[]; confidences: number[] }>();

  for (const node of nodes) {
    const domain = node.domain || deriveDomain(node.memoryType, node.sourceType);
    const entry = domainMap.get(domain) ?? { memoryIds: [], weights: [], confidences: [] };
    entry.memoryIds.push(node.memoryId);
    domainMap.set(domain, entry);
  }

  for (const edge of edges) {
    const sourceNode = nodes.find((n) => n.memoryId === edge.source);
    if (!sourceNode) continue;
    const domain = sourceNode.domain || deriveDomain(sourceNode.memoryType, sourceNode.sourceType);
    const entry = domainMap.get(domain);
    if (entry) {
      entry.weights.push(edge.weight);
      entry.confidences.push(edge.confidence);
    }
  }

  const clusters: OperationalCluster[] = [...domainMap.entries()].map(([domain, data]) => {
    const edgeCount = edges.filter(
      (e) =>
        data.memoryIds.includes(e.source) || data.memoryIds.includes(e.target),
    ).length;
    const maxPossible = Math.max(1, (data.memoryIds.length * (data.memoryIds.length - 1)) / 2);

    return {
      clusterId: domain,
      label: domain.replace(/_/g, " "),
      domain,
      memoryIds: data.memoryIds,
      nodeCount: data.memoryIds.length,
      avgConfidence:
        data.confidences.length > 0
          ? data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length
          : 0,
      avgWeight:
        data.weights.length > 0
          ? data.weights.reduce((a, b) => a + b, 0) / data.weights.length
          : 0,
      relationshipDensity: edgeCount / maxPossible,
    };
  });

  clusters.sort((a, b) => b.nodeCount - a.nodeCount);

  const totalMemories = nodes.length;

  return {
    workspaceId,
    clusters,
    stats: {
      clusterCount: clusters.length,
      totalMemories,
      avgClusterSize:
        clusters.length > 0
          ? clusters.reduce((s, c) => s + c.nodeCount, 0) / clusters.length
          : 0,
    },
    generatedAt: new Date().toISOString(),
  };
}
