import type { PrismaClient } from "@prisma/client";
import type { ChunkMetadataLookup } from "@memory-middleware/domain-engine";
import type { ContextPackageInput } from "@memory-middleware/shared-types";

/** Build per-chunk metadata lookups for fact precedence resolution. */
export async function buildChunkMetadataLookup(
  prisma: PrismaClient,
  contextPackage: ContextPackageInput,
): Promise<Map<string, ChunkMetadataLookup>> {
  const chunkIds = contextPackage.memories.flatMap((m) => m.chunks.map((c) => c.chunkId));
  const memoryIds = [...new Set(contextPackage.memories.map((m) => m.memoryId))];

  if (chunkIds.length === 0) {
    return new Map();
  }

  const [chunks, memories] = await Promise.all([
    prisma.memoryChunk.findMany({
      where: { id: { in: chunkIds } },
      select: { id: true, metadata: true, memoryId: true },
    }),
    prisma.memory.findMany({
      where: { id: { in: memoryIds } },
      select: { id: true, metadata: true },
    }),
  ]);

  const memoryMetaById = new Map<string, Record<string, unknown>>();
  for (const row of memories) {
    memoryMetaById.set(row.id, (row.metadata ?? {}) as Record<string, unknown>);
  }

  const map = new Map<string, ChunkMetadataLookup>();
  for (const chunk of chunks) {
    map.set(chunk.id, {
      memoryMetadata: memoryMetaById.get(chunk.memoryId) ?? {},
      chunkMetadata: (chunk.metadata ?? {}) as Record<string, unknown>,
    });
  }

  return map;
}
