import type {
  AdjacencyHint,
  ContextPackage,
  MemoryRelationship,
  MemoryRelationshipView,
} from "@memory-middleware/shared-types";
import type { FlatChunk } from "./overlap.js";
import { jaccardSimilarity, tokenSet } from "./overlap.js";

export function deriveRelationshipsFromPackage(
  workspaceId: string,
  memoryId: string,
  pkg: ContextPackage,
  chunks: FlatChunk[],
): MemoryRelationshipView {
  const relationships: MemoryRelationship[] = [];
  const adjacencyHints: AdjacencyHint[] = [];
  const coRetrieved = new Map<string, number>();

  const memoryChunks = chunks.filter((c) => c.memoryId === memoryId);
  const memoryMeta = pkg.memories.find((m) => m.memoryId === memoryId);

  if (memoryMeta) {
    for (const other of pkg.memories) {
      if (other.memoryId === memoryId) continue;
      coRetrieved.set(other.memoryId, (coRetrieved.get(other.memoryId) ?? 0) + 0.2);
    }
  }

  const sortedMemoryChunks = [...memoryChunks].sort(
    (a, b) => a.rankingRank - b.rankingRank,
  );

  for (let i = 0; i < sortedMemoryChunks.length - 1; i += 1) {
    const current = sortedMemoryChunks[i]!;
    const next = sortedMemoryChunks[i + 1]!;
    adjacencyHints.push({
      chunkId: current.chunkId,
      adjacentChunkId: next.chunkId,
      memoryId,
      weight: 0.85,
      hintType: "sequential",
    });
  }

  for (let i = 0; i < memoryChunks.length; i += 1) {
    for (let j = i + 1; j < memoryChunks.length; j += 1) {
      const a = memoryChunks[i]!;
      const b = memoryChunks[j]!;
      const overlap = jaccardSimilarity(tokenSet(a.content), tokenSet(b.content));
      if (overlap >= 0.5) {
        adjacencyHints.push({
          chunkId: a.chunkId,
          adjacentChunkId: b.chunkId,
          memoryId,
          weight: overlap,
          hintType: "semantic_overlap",
        });
      }
    }
  }

  for (const other of pkg.memories) {
    if (other.memoryId === memoryId) continue;
    const weight = coRetrieved.get(other.memoryId) ?? 0.15;
    relationships.push({
      sourceMemoryId: memoryId,
      targetMemoryId: other.memoryId,
      relationshipType: "co_retrieval",
      weight,
      metadata: { co_retrieval: true },
    });
  }

  if (memoryMeta?.lineage?.ingestionTraceId) {
    for (const other of pkg.memories) {
      if (
        other.memoryId !== memoryId &&
        other.lineage.ingestionTraceId === memoryMeta.lineage.ingestionTraceId
      ) {
        relationships.push({
          sourceMemoryId: memoryId,
          targetMemoryId: other.memoryId,
          relationshipType: "same_lineage",
          weight: 0.7,
        });
      }
    }
  }

  return {
    memoryId,
    workspaceId,
    relationships: dedupeRelationships(relationships),
    adjacencyHints,
  };
}

export function deriveAllRelationships(
  workspaceId: string,
  pkg: ContextPackage,
  chunks: FlatChunk[],
): MemoryRelationship[] {
  const all: MemoryRelationship[] = [];
  const memoryIds = [...new Set(chunks.map((c) => c.memoryId))];

  for (const memoryId of memoryIds) {
    const view = deriveRelationshipsFromPackage(workspaceId, memoryId, pkg, chunks);
    all.push(...view.relationships);
    for (const hint of view.adjacencyHints) {
      if (hint.hintType === "sequential") {
        all.push({
          sourceMemoryId: memoryId,
          targetMemoryId: memoryId,
          relationshipType: "chunk_adjacency",
          weight: hint.weight,
          metadata: {
            chunkId: hint.chunkId,
            adjacentChunkId: hint.adjacentChunkId,
          },
        });
      }
    }
  }

  return dedupeRelationships(all);
}

function dedupeRelationships(relationships: MemoryRelationship[]): MemoryRelationship[] {
  const seen = new Map<string, MemoryRelationship>();

  for (const rel of relationships) {
    const key = `${rel.sourceMemoryId}:${rel.targetMemoryId}:${rel.relationshipType}`;
    const existing = seen.get(key);
    if (!existing || rel.weight > existing.weight) {
      seen.set(key, rel);
    }
  }

  return [...seen.values()].sort((a, b) => b.weight - a.weight);
}
