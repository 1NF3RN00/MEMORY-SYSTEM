import type { PrismaClient } from "@prisma/client";
import type { EventEmitter } from "@memory-middleware/observability";
import {
  createOpenAiEmbeddingClient,
  runIngestionPipeline,
  type PipelineJobInput,
} from "@memory-middleware/ingestion";
import type { MemoryType, PersistenceMode, SourceType } from "@memory-middleware/shared-types";
import { createPipelineStore } from "./ingestion-store.js";

export interface JobProcessorOptions {
  prisma: PrismaClient;
  events: EventEmitter;
  openAiApiKey?: string;
}

export async function processNextIngestionJob(
  options: JobProcessorOptions,
): Promise<boolean> {
  const job = await options.prisma.ingestionJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  if (!job) return false;

  await options.prisma.ingestionJob.update({
    where: { id: job.id },
    data: {
      status: "processing",
      startedAt: new Date(),
      attemptCount: { increment: 1 },
    },
  });

  const payload = job.inputPayload as {
    content?: string;
    url?: string;
    title?: string;
    sourceUrl?: string;
    sourceLabel?: string;
    tags?: string[];
  };

  const pipelineInput: PipelineJobInput = {
    workspaceId: job.workspaceId,
    traceId: job.traceId,
    sourceType: job.sourceType as SourceType,
    persistenceMode: job.persistenceMode as PersistenceMode,
    memoryType: job.memoryType as MemoryType,
    ...(payload.content ? { rawContent: payload.content } : {}),
    ...(payload.url ? { url: payload.url } : {}),
    ...(payload.title ? { title: payload.title } : {}),
    ...(payload.sourceUrl ? { sourceUrl: payload.sourceUrl } : {}),
    ...(payload.sourceLabel ? { sourceLabel: payload.sourceLabel } : {}),
    ...(payload.tags ? { tags: payload.tags } : {}),
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
  } catch (error) {
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

export async function expireTemporaryMemories(
  prisma: PrismaClient,
  events: EventEmitter,
): Promise<number> {
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
