import type { PrismaClient } from "@prisma/client";
import { createPipelineStore } from "./ingestion-store.js";
import {
  parseObservationMetadata,
  type ObservationIngestionStore,
  type StoredObservationRecord,
} from "@memory-middleware/observation-ingestion";
import { newUlid } from "@memory-middleware/shared-types";

export function createObservationIngestionStore(prisma: PrismaClient): ObservationIngestionStore {
  return {
    pipelineStore: createPipelineStore(prisma),

    async createIngestionTrace(workspaceId, traceId) {
      await prisma.ingestionTrace.create({
        data: {
          id: newUlid(),
          workspaceId,
          traceId,
          status: "pending",
          sourceType: "json",
          persistenceMode: "persistent",
          stages: [],
        },
      });
    },

    async listActiveObservations(workspaceId) {
      const rows = await prisma.memory.findMany({
        where: {
          workspaceId,
          archived: false,
          memoryType: "observation",
        },
        select: {
          id: true,
          metadata: true,
        },
      });

      const records: StoredObservationRecord[] = [];
      for (const row of rows) {
        const metadata = parseObservationMetadata(row.metadata);
        if (!metadata) continue;
        records.push({
          memoryId: row.id,
          collectedAt: metadata.collectedAt,
          metadata,
        });
      }
      return records;
    },

    async archiveMemory(memoryId) {
      await prisma.memory.update({
        where: { id: memoryId },
        data: {
          archived: true,
          archivedAt: new Date(),
          retrievalEligible: false,
          ingestionStatus: "archived",
        },
      });
    },
  };
}
