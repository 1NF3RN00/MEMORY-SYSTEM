import type {
  ChunkLineage,
  MemoryAdjacencyView,
  StructuralSegmentationReason,
} from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";

export interface ChunkWithLineage {
  id: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  lineage: ChunkLineage;
  segmentationReason: StructuralSegmentationReason;
}

/** Assign prev/next/sibling relationships deterministically. */
export function generateAdjacency(chunks: ChunkWithLineage[]): ChunkWithLineage[] {
  if (chunks.length === 0) return [];

  const bySection = new Map<string, number[]>();
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;
    const key = chunk.lineage.sectionPath.join("/") || "(root)";
    const group = bySection.get(key) ?? [];
    group.push(i);
    bySection.set(key, group);
  }

  return chunks.map((chunk, index) => {
    const sectionKey = chunk.lineage.sectionPath.join("/") || "(root)";
    const siblings = bySection.get(sectionKey) ?? [index];
    const siblingIndices = siblings.filter((i) => i !== index);

    const previousChunkId = index > 0 ? chunks[index - 1]?.id : undefined;
    const nextChunkId = index < chunks.length - 1 ? chunks[index + 1]?.id : undefined;

    const siblingChunkIds = siblingIndices
      .map((i) => chunks[i]?.id)
      .filter((id): id is string => id !== undefined);

    const parentChunkId = siblingIndices.length > 0
      ? chunks[siblingIndices[0] ?? 0]?.id
      : undefined;

    return {
      ...chunk,
      lineage: {
        ...chunk.lineage,
        ...(parentChunkId ? { parentChunkId } : {}),
        ...(previousChunkId ? { previousChunkId } : {}),
        ...(nextChunkId ? { nextChunkId } : {}),
        siblingChunkIds,
      },
    };
  });
}

/** Build semantic group IDs for chunks sharing a section. */
export function assignSemanticGroups(chunks: ChunkWithLineage[]): ChunkWithLineage[] {
  const sectionGroups = new Map<string, string>();

  return chunks.map((chunk) => {
    const key = chunk.lineage.sectionPath.join("/") || "(root)";
    let groupId = sectionGroups.get(key);
    if (!groupId) {
      groupId = newUlid();
      sectionGroups.set(key, groupId);
    }

    return {
      ...chunk,
      lineage: {
        ...chunk.lineage,
        semanticGroupId: groupId,
      },
      segmentationReason: {
        ...chunk.segmentationReason,
        semanticGroupId: groupId,
      },
    };
  });
}

/** Build adjacency view for API/dashboard. */
export function buildAdjacencyView(
  memoryId: string,
  chunks: ChunkWithLineage[],
): MemoryAdjacencyView {
  const sectionMap = new Map<string, string[]>();

  const adjacencyGraph = chunks.map((chunk) => {
    const pathKey = chunk.lineage.sectionPath.join("/") || "(root)";
    const existing = sectionMap.get(pathKey) ?? [];
    existing.push(chunk.id);
    sectionMap.set(pathKey, existing);

    return {
      chunkId: chunk.id,
      chunkIndex: chunk.chunkIndex,
      ...(chunk.lineage.previousChunkId
        ? { previousChunkId: chunk.lineage.previousChunkId }
        : {}),
      ...(chunk.lineage.nextChunkId ? { nextChunkId: chunk.lineage.nextChunkId } : {}),
      siblingChunkIds: chunk.lineage.siblingChunkIds ?? [],
      sectionPath: chunk.lineage.sectionPath,
      headingHierarchy: chunk.lineage.headingHierarchy,
      ...(chunk.lineage.semanticGroupId
        ? { semanticGroupId: chunk.lineage.semanticGroupId }
        : {}),
    };
  });

  const sectionHierarchy = [...sectionMap.entries()].map(([path, chunkIds]) => ({
    path: path === "(root)" ? [] : path.split("/"),
    chunkIds,
  }));

  return { memoryId, adjacencyGraph, sectionHierarchy };
}
