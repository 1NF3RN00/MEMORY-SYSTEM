import type { PrismaClient } from "@prisma/client";
import type { DbScopeSummary } from "@memory-middleware/shared-types";
import {
  emitDbScopeCompleted,
  emitLlmCallAudit,
  emitTimingAudit,
  ExecutionTimingCollector,
  LlmCallCollector,
  runWithDbObservationScope,
  runWithTimingAsync,
  type EventEmitter,
  type Logger,
} from "@memory-middleware/observability";
import { loadDbObservabilityEnv } from "../config/db-observability-env.js";
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
  logger?: Logger;
  openAiApiKey?: string;
}

interface WorkerJobCollectors {
  timingCollector: ExecutionTimingCollector;
  llmCallCollector: LlmCallCollector;
}

async function emitWorkerJobAudits(
  options: JobProcessorOptions,
  job: { id: string; traceId: string },
  collectors: WorkerJobCollectors,
  summary: DbScopeSummary,
): Promise<void> {
  if (!options.logger) return;

  const dbEnv = loadDbObservabilityEnv();
  const metadata = { scope: "worker", job_id: job.id };

  const emitSafe = async (audit: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
    } catch (error) {
      options.logger?.warn(
        { error, audit, trace_id: job.traceId, job_id: job.id },
        "worker.audit.emit_failed",
      );
    }
  };

  await emitSafe("timing", () =>
    emitTimingAudit(options.logger!, options.events, collectors.timingCollector.toAudit(), metadata),
  );
  await emitSafe("llm", () =>
    emitLlmCallAudit(options.logger!, options.events, collectors.llmCallCollector.toAudit(), metadata),
  );
  await emitSafe("db", () =>
    emitDbScopeCompleted(options.logger!, options.events, summary, {
      leaderboardCapacity: dbEnv.DB_LEADERBOARD_SIZE,
      metadata,
    }),
  );
}

export async function processNextIngestionJob(
  options: JobProcessorOptions,
): Promise<boolean> {
  const job = await options.prisma.ingestionJob.findFirst({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
  });

  if (!job) return false;

  const dbEnv = loadDbObservabilityEnv();
  const collectors: WorkerJobCollectors = {
    timingCollector: new ExecutionTimingCollector(job.traceId),
    llmCallCollector: new LlmCallCollector(job.traceId),
  };

  const { result: processed, summary } = await runWithDbObservationScope(
    { scopeId: job.traceId, scopeType: "worker" },
    async () =>
      runWithTimingAsync(
        collectors.timingCollector,
        async () => {
          await collectors.timingCollector.measureAsync("worker_job:claim", async () => {
            await options.prisma.ingestionJob.update({
              where: { id: job.id },
              data: {
                status: "processing",
                startedAt: new Date(),
                attemptCount: { increment: 1 },
              },
            });
          });

          return processIngestionJobBody(options, job, collectors);
        },
        collectors.llmCallCollector,
      ),
    {
      slowQueryMs: dbEnv.DB_SLOW_QUERY_MS,
      nPlusOneThreshold: dbEnv.DB_N_PLUS_ONE_THRESHOLD,
    },
  );

  await emitWorkerJobAudits(options, job, collectors, summary);

  return processed;
}

async function processIngestionJobBody(
  options: JobProcessorOptions,
  job: {
    id: string;
    workspaceId: string;
    traceId: string;
    sourceType: string;
    persistenceMode: string;
    memoryType: string;
    useLlmStructuring: boolean;
    attemptCount: number;
    maxAttempts: number;
    inputPayload: unknown;
  },
  collectors: WorkerJobCollectors,
): Promise<boolean> {
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
    const result = await collectors.timingCollector.measureAsync(
      "worker_job:ingestion",
      async () =>
        runIngestionPipeline(pipelineInput, {
          events: options.events,
          store: createPipelineStore(options.prisma),
          embeddingClient,
          timingCollector: collectors.timingCollector,
        }),
    );

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
      const existingTrace = await options.prisma.ingestionTrace.findUnique({
        where: { traceId: job.traceId },
        select: { workspaceId: true, status: true },
      });

      await options.prisma.ingestionTrace.update({
        where: { traceId: job.traceId },
        data: { status: "failed" },
      });

      if (existingTrace && existingTrace.status !== "failed") {
        const { recordIngestionMetrics } = await import("./metrics-aggregation-store.js");
        await recordIngestionMetrics(options.prisma, existingTrace.workspaceId, "failed");
      }
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

    const { adjustActiveMemories } = await import("./metrics-aggregation-store.js");
    await adjustActiveMemories(prisma, memory.workspaceId, -1);

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
