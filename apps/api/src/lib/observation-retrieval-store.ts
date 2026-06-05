import type { PrismaClient } from "@prisma/client";
import type { ObservationRetrievalStore } from "@memory-middleware/retrieval";

export function createObservationRetrievalStore(prisma: PrismaClient): ObservationRetrievalStore {
  return {
    async listObservationMemories(workspaceId) {
      const rows = await prisma.memory.findMany({
        where: {
          workspaceId,
          archived: false,
          memoryType: "observation",
        },
        orderBy: { createdAt: "desc" },
        include: {
          chunks: {
            orderBy: { sequence: "asc" },
            take: 1,
          },
        },
      });

      return rows
        .filter((row) => row.chunks[0])
        .map((row) => ({
          memoryId: row.id,
          metadata: row.metadata,
          chunkContent: row.chunks[0]!.content,
        }));
    },
  };
}
