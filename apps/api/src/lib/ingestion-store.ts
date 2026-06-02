import { Prisma, type PrismaClient } from "@prisma/client";
import type { PipelineStore } from "@memory-middleware/ingestion";
import { newUlid } from "@memory-middleware/shared-types";
import type {
  CanonicalMemoryObject,
  IngestionStageRecord,
  IngestionState,
  IngestionTraceView,
  NormalizationTraceView,
  SourceTruthView,
} from "@memory-middleware/shared-types";

export function createPipelineStore(prisma: PrismaClient): PipelineStore {
  return {
    async updateTraceStatus(traceId, status, stages, normalizationTrace) {
      await prisma.ingestionTrace.update({
        where: { traceId },
        data: {
          status,
          stages: stages as unknown as Prisma.InputJsonValue,
          ...(normalizationTrace
            ? { normalizationTrace: normalizationTrace as Prisma.InputJsonValue }
            : {}),
        },
      });
    },

    async persistSourceTruth(data) {
      await prisma.sourceTruth.create({
        data: {
          id: newUlid(),
          workspaceId: data.workspaceId,
          traceId: data.traceId,
          rawSource: data.rawSource,
          ...(data.crawlerOutput
            ? { crawlerOutput: data.crawlerOutput as Prisma.InputJsonValue }
            : {}),
          normalizationTransformations: data.normalizationTransformations as Prisma.InputJsonValue,
        },
      });
    },

    async persistMemory(memory: CanonicalMemoryObject, lineageId: string) {
      await prisma.$transaction(async (tx) => {
        await tx.memory.create({
          data: {
            id: memory.id,
            workspaceId: memory.workspaceId,
            lineageId,
            version: memory.version,
            parentMemoryId: memory.parentMemoryId ?? null,
            memoryType: memory.memoryType,
            persistenceMode: memory.persistenceMode,
            sourceType: memory.sourceType,
            title: memory.title,
            content: memory.normalizedContent,
            normalizedContent: memory.normalizedContent,
            summary: memory.summary ?? null,
            ingestionStatus: "stored",
            ingestionTraceId: memory.lineage.ingestionTraceId,
            normalizationTraceId: memory.lineage.normalizationTraceId,
            embeddingVersion: memory.metadata.embeddingVersion,
            normalizationVersion: memory.metadata.normalizationVersion,
            metadata: memory.metadata as unknown as Prisma.InputJsonValue,
            scoring: memory.scoring as unknown as Prisma.InputJsonValue,
            lineage: memory.lineage as unknown as Prisma.InputJsonValue,
            observability: memory.observability as unknown as Prisma.InputJsonValue,
            retrievalEligible: memory.observability.retrievalEligible,
            archived: memory.observability.archived,
          },
        });

        for (const chunk of memory.chunks) {
          await tx.memoryChunk.create({
            data: {
              id: chunk.id,
              memoryId: memory.id,
              sequence: chunk.chunkIndex,
              content: chunk.content,
              tokenCount: chunk.tokenCount,
              embeddingStatus: chunk.embeddingStatus,
              metadata: chunk.metadata as unknown as Prisma.InputJsonValue,
              observability: chunk.observability as unknown as Prisma.InputJsonValue,
            },
          });
        }

        await tx.ingestionTrace.update({
          where: { traceId: memory.lineage.ingestionTraceId },
          data: { memoryId: memory.id },
        });

        await tx.sourceTruth.updateMany({
          where: { traceId: memory.lineage.ingestionTraceId },
          data: { memoryId: memory.id },
        });
      });
    },

    async updateChunkEmbeddings(memoryId, chunks) {
      for (const chunk of chunks) {
        if (chunk.embedding && chunk.embeddingStatus === "completed") {
          const vectorLiteral = `[${chunk.embedding.join(",")}]`;
          await prisma.$executeRawUnsafe(
            `UPDATE memory_chunks SET embedding = $1::vector, embedding_status = $2 WHERE id = $3`,
            vectorLiteral,
            chunk.embeddingStatus,
            chunk.id,
          );
        } else {
          await prisma.memoryChunk.update({
            where: { id: chunk.id },
            data: { embeddingStatus: chunk.embeddingStatus },
          });
        }
      }
    },
  };
}

export async function getIngestionTrace(
  prisma: PrismaClient,
  traceId: string,
): Promise<IngestionTraceView | null> {
  const trace = await prisma.ingestionTrace.findUnique({ where: { traceId } });
  if (!trace) return null;

  return {
    traceId: trace.traceId,
    workspaceId: trace.workspaceId,
    ...(trace.memoryId ? { memoryId: trace.memoryId } : {}),
    status: trace.status as IngestionState,
    sourceType: trace.sourceType as IngestionTraceView["sourceType"],
    persistenceMode: trace.persistenceMode as IngestionTraceView["persistenceMode"],
    stages: trace.stages as unknown as IngestionStageRecord[],
    ...(trace.normalizationTrace
      ? { normalizationTrace: trace.normalizationTrace as unknown as NormalizationTraceView }
      : {}),
    createdAt: trace.createdAt.toISOString(),
    updatedAt: trace.updatedAt.toISOString(),
  };
}

export async function getSourceTruth(
  prisma: PrismaClient,
  traceId: string,
): Promise<SourceTruthView | null> {
  const record = await prisma.sourceTruth.findFirst({
    where: { traceId },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return null;

  return {
    traceId: record.traceId,
    workspaceId: record.workspaceId,
    ...(record.memoryId ? { memoryId: record.memoryId } : {}),
    rawSource: record.rawSource,
    ...(record.crawlerOutput
      ? { crawlerOutput: record.crawlerOutput as Record<string, unknown> }
      : {}),
    normalizationTransformations: record.normalizationTransformations as SourceTruthView["normalizationTransformations"],
    createdAt: record.createdAt.toISOString(),
  };
}
