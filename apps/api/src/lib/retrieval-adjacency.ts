import type { PrismaClient } from "@prisma/client";
import type { ChunkAdjacencyLookup, MemoryMetadataLookup } from "@memory-middleware/retrieval";
import type { ChunkLineage, SemanticSurface } from "@memory-middleware/shared-types";

/** Build chunk adjacency lookup from memory chunks for retrieval expansion. */
export async function buildAdjacencyLookupForChunks(
  prisma: PrismaClient,
  chunkIds: string[],
): Promise<Map<string, ChunkAdjacencyLookup>> {
  if (chunkIds.length === 0) return new Map();

  const chunks = await prisma.memoryChunk.findMany({
    where: { id: { in: chunkIds } },
    select: {
      id: true,
      memoryId: true,
      content: true,
      metadata: true,
    },
  });

  const lookup = new Map<string, ChunkAdjacencyLookup>();

  for (const chunk of chunks) {
    const metadata = (chunk.metadata ?? {}) as Record<string, unknown>;
    const lineage = metadata.lineage as ChunkLineage | undefined;

    lookup.set(chunk.id, {
      chunkId: chunk.id,
      memoryId: chunk.memoryId,
      content: chunk.content,
      ...(lineage
        ? {
            lineage: {
              ...(lineage.previousChunkId
                ? { previousChunkId: lineage.previousChunkId }
                : {}),
              ...(lineage.nextChunkId ? { nextChunkId: lineage.nextChunkId } : {}),
              siblingChunkIds: lineage.siblingChunkIds ?? [],
              sectionPath: lineage.sectionPath,
              headingHierarchy: lineage.headingHierarchy,
              ...(lineage.semanticGroupId
                ? { semanticGroupId: lineage.semanticGroupId }
                : {}),
            },
          }
        : {}),
    });
  }

  return lookup;
}

/** Load memory metadata for retrieval expansion. */
export async function loadMemoryMetadataForExpansion(
  prisma: PrismaClient,
  memoryIds: string[],
): Promise<MemoryMetadataLookup[]> {
  if (memoryIds.length === 0) return [];

  const memories = await prisma.memory.findMany({
    where: { id: { in: memoryIds } },
    select: {
      id: true,
      title: true,
      memoryType: true,
      metadata: true,
      chunks: { select: { metadata: true } },
    },
  });

  return memories.map((m) => {
    const metadata = (m.metadata ?? {}) as Record<string, unknown>;
    const tags = metadata.tags as string[] | undefined;

    const surfaces: SemanticSurface[] = [];
    for (const chunk of m.chunks) {
      const chunkMeta = (chunk.metadata ?? {}) as Record<string, unknown>;
      const surface = chunkMeta.semanticSurface as SemanticSurface | undefined;
      if (surface) surfaces.push(surface);
    }

    const mergedSurface: SemanticSurface | undefined =
      surfaces.length > 0
        ? {
            primaryConcepts: [...new Set(surfaces.flatMap((s) => s.primaryConcepts))].slice(0, 12),
            operationalDomains: [...new Set(surfaces.flatMap((s) => s.operationalDomains))],
            semanticAliases: [...new Set(surfaces.flatMap((s) => s.semanticAliases))].slice(0, 10),
            contextualKeywords: [...new Set(surfaces.flatMap((s) => s.contextualKeywords))].slice(0, 10),
            ...(surfaces.find((s) => s.hierarchyPath?.length)?.hierarchyPath
              ? { hierarchyPath: surfaces.find((s) => s.hierarchyPath?.length)!.hierarchyPath! }
              : {}),
          }
        : undefined;

    return {
      memoryId: m.id,
      title: m.title,
      memoryType: m.memoryType,
      ...(tags?.length ? { tags } : {}),
      ...(mergedSurface ? { semanticSurface: mergedSurface } : {}),
    };
  });
}
