import { Prisma } from "@prisma/client";
export function createPipelineStore(prisma) {
    return {
        async updateTraceStatus(traceId, status, stages, normalizationTrace) {
            await prisma.ingestionTrace.update({
                where: { traceId },
                data: {
                    status,
                    stages: stages,
                    ...(normalizationTrace
                        ? { normalizationTrace: normalizationTrace }
                        : {}),
                },
            });
        },
        async persistSourceTruth(data) {
            await prisma.sourceTruth.create({
                data: {
                    workspaceId: data.workspaceId,
                    traceId: data.traceId,
                    rawSource: data.rawSource,
                    crawlerOutput: data.crawlerOutput,
                    normalizationTransformations: data.normalizationTransformations,
                },
            });
        },
        async persistMemory(memory, lineageId) {
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
                        metadata: memory.metadata,
                        scoring: memory.scoring,
                        lineage: memory.lineage,
                        observability: memory.observability,
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
                            metadata: chunk.metadata,
                            observability: chunk.observability,
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
                    await prisma.$executeRawUnsafe(`UPDATE memory_chunks SET embedding = $1::vector, embedding_status = $2 WHERE id = $3::uuid`, vectorLiteral, chunk.embeddingStatus, chunk.id);
                }
                else {
                    await prisma.memoryChunk.update({
                        where: { id: chunk.id },
                        data: { embeddingStatus: chunk.embeddingStatus },
                    });
                }
            }
        },
    };
}
export async function getIngestionTrace(prisma, traceId) {
    const trace = await prisma.ingestionTrace.findUnique({ where: { traceId } });
    if (!trace)
        return null;
    return {
        traceId: trace.traceId,
        workspaceId: trace.workspaceId,
        ...(trace.memoryId ? { memoryId: trace.memoryId } : {}),
        status: trace.status,
        sourceType: trace.sourceType,
        persistenceMode: trace.persistenceMode,
        stages: trace.stages,
        ...(trace.normalizationTrace
            ? { normalizationTrace: trace.normalizationTrace }
            : {}),
        createdAt: trace.createdAt.toISOString(),
        updatedAt: trace.updatedAt.toISOString(),
    };
}
export async function getSourceTruth(prisma, traceId) {
    const record = await prisma.sourceTruth.findFirst({
        where: { traceId },
        orderBy: { createdAt: "desc" },
    });
    if (!record)
        return null;
    return {
        traceId: record.traceId,
        workspaceId: record.workspaceId,
        ...(record.memoryId ? { memoryId: record.memoryId } : {}),
        rawSource: record.rawSource,
        ...(record.crawlerOutput
            ? { crawlerOutput: record.crawlerOutput }
            : {}),
        normalizationTransformations: record.normalizationTransformations,
        createdAt: record.createdAt.toISOString(),
    };
}
//# sourceMappingURL=ingestion-store.js.map