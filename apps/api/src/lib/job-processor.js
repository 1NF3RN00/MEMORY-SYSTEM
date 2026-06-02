import { createOpenAiEmbeddingClient, runIngestionPipeline, } from "@memory-middleware/ingestion";
import { createPipelineStore } from "./ingestion-store.js";
export async function processNextIngestionJob(options) {
    const job = await options.prisma.ingestionJob.findFirst({
        where: { status: "pending" },
        orderBy: { createdAt: "asc" },
    });
    if (!job)
        return false;
    await options.prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
            status: "processing",
            startedAt: new Date(),
            attemptCount: { increment: 1 },
        },
    });
    const payload = job.inputPayload;
    const pipelineInput = {
        workspaceId: job.workspaceId,
        traceId: job.traceId,
        sourceType: job.sourceType,
        persistenceMode: job.persistenceMode,
        memoryType: job.memoryType,
        rawContent: payload.content,
        url: payload.url,
        title: payload.title,
        sourceUrl: payload.sourceUrl,
        sourceLabel: payload.sourceLabel,
        tags: payload.tags,
        useLlmStructuring: job.useLlmStructuring,
    };
    const embeddingClient = options.openAiApiKey
        ? createOpenAiEmbeddingClient(options.openAiApiKey)
        : null;
    try {
        const result = await runIngestionPipeline(pipelineInput, {
            events: options.events,
            store: createPipelineStore(options.prisma),
            embeddingClient,
        });
        await options.prisma.ingestionJob.update({
            where: { id: job.id },
            data: {
                status: result.status,
                memoryId: result.memory.id,
                lineageId: result.lineageId,
                completedAt: new Date(),
            },
        });
        if (job.persistenceMode === "temporary") {
            const expiresAt = new Date(Date.now() + 3_600_000);
            await options.prisma.memory.update({
                where: { id: result.memory.id },
                data: { expiresAt },
            });
        }
        return true;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const failed = job.attemptCount >= job.maxAttempts;
        await options.prisma.ingestionJob.update({
            where: { id: job.id },
            data: {
                status: failed ? "failed" : "pending",
                lastError: message,
                ...(failed ? { completedAt: new Date() } : {}),
            },
        });
        if (failed) {
            await options.prisma.ingestionTrace.update({
                where: { traceId: job.traceId },
                data: { status: "failed" },
            });
        }
        return true;
    }
}
export async function expireTemporaryMemories(prisma, events) {
    const expired = await prisma.memory.findMany({
        where: {
            persistenceMode: "temporary",
            archived: false,
            expiresAt: { lte: new Date() },
        },
        take: 50,
    });
    for (const memory of expired) {
        await prisma.memory.update({
            where: { id: memory.id },
            data: {
                archived: true,
                archivedAt: new Date(),
                retrievalEligible: false,
                ingestionStatus: "archived",
            },
        });
        await events.emit({
            event_type: "ingestion.temporary.expired",
            trace_id: memory.ingestionTraceId,
            workspace_id: memory.workspaceId,
            metadata: {
                operation: "archival",
                success: true,
                memory_id: memory.id,
            },
        });
        await events.emit({
            event_type: "ingestion.archived",
            trace_id: memory.ingestionTraceId,
            workspace_id: memory.workspaceId,
            metadata: {
                operation: "archival",
                success: true,
                memory_id: memory.id,
                reason: "temporary_expired",
            },
        });
    }
    return expired.length;
}
//# sourceMappingURL=job-processor.js.map