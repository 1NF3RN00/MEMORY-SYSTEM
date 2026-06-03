/**
 * Backfill deterministic semantic surfaces on existing memory chunks.
 * Run: npx tsx apps/api/scripts/backfill-chunk-semantic-surfaces.ts [workspaceId]
 */
import { PrismaClient } from "@prisma/client";
import { buildChunkRetrievalSurface } from "@memory-middleware/structural";
import type { ChunkLineage } from "@memory-middleware/shared-types";

const prisma = new PrismaClient();
const workspaceId = process.argv[2];

const chunkSelect = {
  id: true,
  content: true,
  metadata: true,
  memory: { select: { memoryType: true, metadata: true } },
} as const;

async function main(): Promise<void> {
  const chunks = workspaceId
    ? await prisma.memoryChunk.findMany({
        where: { memory: { workspaceId } },
        select: chunkSelect,
      })
    : await prisma.memoryChunk.findMany({
        where: {},
        select: chunkSelect,
        take: 5000,
      });

  let updated = 0;
  for (const chunk of chunks) {
    const metadata = (chunk.metadata ?? {}) as Record<string, unknown>;
    if (metadata.semanticSurface && metadata.retrievalSurface) continue;

    const memoryMeta = (chunk.memory.metadata ?? {}) as Record<string, unknown>;
    const tags = memoryMeta.tags as string[] | undefined;
    const lineage = metadata.lineage as ChunkLineage | undefined;

    const retrievalSurface = buildChunkRetrievalSurface({
      content: chunk.content,
      ...(lineage ? { lineage } : {}),
      ...(tags?.length ? { tags } : {}),
      memoryType: chunk.memory.memoryType,
    });

    await prisma.memoryChunk.update({
      where: { id: chunk.id },
      data: {
        metadata: {
          ...metadata,
          semanticSurface: retrievalSurface.semanticSurface,
          retrievalSurface,
        } as object,
      },
    });
    updated += 1;
  }

  console.log(`Backfilled semantic surfaces on ${updated} chunk(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
