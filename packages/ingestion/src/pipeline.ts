import type { EventEmitter, ExecutionTimingCollector } from "@memory-middleware/observability";
import { measurePipelineStage, resolvePipelineCollector } from "@memory-middleware/observability";
import { normalizeContent } from "@memory-middleware/normalization";
import { newUlid } from "@memory-middleware/shared-types";
import type {
  CanonicalMemoryChunk,
  CanonicalMemoryMetadata,
  CanonicalMemoryObject,
  IngestionStageRecord,
  IngestionState,
  MemoryType,
  PersistenceMode,
  SourceType,
} from "@memory-middleware/shared-types";
import { crawlWebsite } from "./crawler.js";
import {
  averageDensityScore,
  emitAdjacencyGenerationCompleted,
  emitSemanticDensityScored,
  emitSemanticSegmentationCompleted,
  emitStructuralFallback,
  emitStructureParsingCompleted,
  structureAwareChunk,
  toCanonicalChunks,
} from "@memory-middleware/structural";
import type { EmbeddingClient } from "./embedding.js";
import { embedChunks } from "./embedding.js";
import {
  emitChunkingCompleted,
  emitEmbeddingCompleted,
  emitEmbeddingFailed,
  emitIngestionCompleted,
  emitIngestionStarted,
  emitNormalizationCompleted,
} from "./events.js";
import { buildCanonicalMemory } from "./memory-builder.js";

export interface PipelineJobInput {
  workspaceId: string;
  traceId: string;
  sourceType: SourceType;
  persistenceMode: PersistenceMode;
  memoryType: MemoryType;
  rawContent?: string;
  url?: string;
  title?: string;
  sourceUrl?: string;
  sourceLabel?: string;
  tags?: string[];
  useLlmStructuring?: boolean;
  /** Observation ingestion — stable memory ID aligned with observationId */
  memoryId?: string;
  metadataPatch?: Partial<CanonicalMemoryMetadata>;
  /** When set, skips structural chunking (single-chunk observations). */
  fixedChunks?: CanonicalMemoryChunk[];
}

export interface PipelineStore {
  updateTraceStatus(
    traceId: string,
    status: IngestionState,
    stages: IngestionStageRecord[],
    normalizationTrace?: Record<string, unknown>,
  ): Promise<void>;
  persistSourceTruth(data: {
    traceId: string;
    workspaceId: string;
    rawSource: string;
    crawlerOutput?: Record<string, unknown>;
    normalizationTransformations: Array<{
      step: string;
      inputPreview: string;
      outputPreview: string;
      timestamp: string;
    }>;
  }): Promise<void>;
  persistMemory(memory: CanonicalMemoryObject, lineageId: string): Promise<void>;
  updateChunkEmbeddings(
    memoryId: string,
    chunks: CanonicalMemoryObject["chunks"],
  ): Promise<void>;
}

export interface PipelineOptions {
  events: EventEmitter;
  store: PipelineStore;
  embeddingClient: EmbeddingClient | null;
  /** Request-scoped high-resolution timing collector */
  timingCollector?: ExecutionTimingCollector;
}

function stage(
  name: IngestionStageRecord["stage"],
  status: IngestionStageRecord["status"],
  startedAt: string,
  completedAt?: string,
  latencyMs?: number,
  error?: string,
): IngestionStageRecord {
  return {
    stage: name,
    status,
    startedAt,
    ...(completedAt ? { completedAt } : {}),
    ...(latencyMs !== undefined ? { latencyMs } : {}),
    ...(error ? { error } : {}),
  };
}

export async function runIngestionPipeline(
  input: PipelineJobInput,
  options: PipelineOptions,
): Promise<{ memory: CanonicalMemoryObject; status: IngestionState; lineageId: string }> {
  const timing = resolvePipelineCollector(input.traceId, options.timingCollector);
  return measurePipelineStage(input.traceId, "ingestion", timing, async () => {
  const pipelineStarted = Date.now();
  const stages: IngestionStageRecord[] = [];
  const normalizationTraceId = newUlid();
  const lineageId = newUlid();

  await options.store.updateTraceStatus(input.traceId, "processing", stages);
  await emitIngestionStarted(options.events, {
    traceId: input.traceId,
    workspaceId: input.workspaceId,
  });

  const normStageStart = new Date().toISOString();

  try {
    const normStarted = Date.now();
    const { normalized } = await measurePipelineStage(
      input.traceId,
      "normalization",
      timing,
      async () => {
        let rawSource = input.rawContent ?? "";
        let truthRaw = rawSource;
        let crawlMeta: Record<string, unknown> | undefined;

        if (input.sourceType === "website") {
          const url = input.url ?? input.sourceUrl;
          if (!url) throw new Error("Website ingestion requires url");
          const crawl = await crawlWebsite(url);
          truthRaw = crawl.rawHtml;
          crawlMeta = {
            url: crawl.url,
            extractedTitle: crawl.extractedTitle,
            cleanedHtml: crawl.cleanedHtml,
            markdown: crawl.markdown,
            fetchedAt: crawl.fetchedAt,
          };
          rawSource = crawl.markdown;
        }

        const normalizedContent = await normalizeContent({
          sourceType: input.sourceType === "website" ? "markdown" : input.sourceType,
          rawContent: rawSource,
          ...(input.title ? { title: input.title } : {}),
          ...((input.sourceUrl ?? input.url)
            ? { sourceUrl: (input.sourceUrl ?? input.url) as string }
            : {}),
          useLlmStructuring: input.useLlmStructuring ?? false,
        });

        await options.store.persistSourceTruth({
          traceId: input.traceId,
          workspaceId: input.workspaceId,
          rawSource: truthRaw,
          ...(crawlMeta ? { crawlerOutput: crawlMeta } : {}),
          normalizationTransformations: normalizedContent.transformations,
        });

        return { normalized: normalizedContent };
      },
    );

    stages.push(
      stage("normalized", "completed", normStageStart, new Date().toISOString(), Date.now() - normStarted),
    );
    const normalizationTrace = {
      traceId: normalizationTraceId,
      strategy: normalized.strategy,
      usedLlm: normalized.usedLlm,
      steps: normalized.steps,
    };

    await options.store.updateTraceStatus(
      input.traceId,
      "normalized",
      stages,
      normalizationTrace,
    );
    await emitNormalizationCompleted(options.events, {
      traceId: input.traceId,
      workspaceId: input.workspaceId,
      latencyMs: Date.now() - normStarted,
      extra: { normalization_trace_id: normalizationTraceId },
    });

    const chunkStageStart = new Date().toISOString();
    const chunkStarted = Date.now();

    const { preChunks, avgDensity, structuralMeta } = await measurePipelineStage(
      input.traceId,
      "chunking",
      timing,
      async () => {
        const pendingMemoryId = input.memoryId ?? "pending";
        let chunks: CanonicalMemoryObject["chunks"];
        let density = 0;
        let meta: {
          chunkingStrategy: string;
          fallbackUsed: boolean;
          fallbackReason?: string;
        };

        if (input.fixedChunks?.length) {
          chunks = input.fixedChunks.map((chunk, index) => ({
            ...chunk,
            memoryId: pendingMemoryId,
            chunkIndex: index,
          }));
          meta = {
            chunkingStrategy: "observation-v1",
            fallbackUsed: false,
          };
        } else {
          const structuralResult = structureAwareChunk({
            memoryId: pendingMemoryId,
            normalizedContent: normalized.normalizedContent,
            sourceType: input.sourceType === "website" ? "markdown" : input.sourceType,
          });

          await emitStructureParsingCompleted(options.events, {
            traceId: input.traceId,
            workspaceId: input.workspaceId,
            latencyMs: structuralResult.structureParseLatencyMs,
            extra: {
              strategy: structuralResult.strategy,
              fallback_used: structuralResult.fallbackUsed,
              section_count: structuralResult.segmentationReasons.length,
            },
          });

          if (structuralResult.fallbackUsed && structuralResult.fallbackReason) {
            await emitStructuralFallback(options.events, {
              traceId: input.traceId,
              workspaceId: input.workspaceId,
              reason: structuralResult.fallbackReason,
              extra: { chunk_count: structuralResult.chunks.length },
            });
          } else {
            await emitSemanticSegmentationCompleted(options.events, {
              traceId: input.traceId,
              workspaceId: input.workspaceId,
              extra: {
                chunk_count: structuralResult.chunks.length,
                segmentation_reasons: structuralResult.segmentationReasons.length,
              },
            });
            await emitAdjacencyGenerationCompleted(options.events, {
              traceId: input.traceId,
              workspaceId: input.workspaceId,
              extra: { chunk_count: structuralResult.chunks.length },
            });
          }

          density = averageDensityScore(
            structuralResult.chunks.map((c) => c.densityDetail),
          );
          await emitSemanticDensityScored(options.events, {
            traceId: input.traceId,
            workspaceId: input.workspaceId,
            extra: { average_density: density, chunk_count: structuralResult.chunks.length },
          });

          chunks = toCanonicalChunks(pendingMemoryId, structuralResult, {
            ...(input.tags ? { tags: input.tags } : {}),
            memoryType: input.memoryType,
          });
          meta = {
            chunkingStrategy: structuralResult.strategy,
            fallbackUsed: structuralResult.fallbackUsed,
            ...(structuralResult.fallbackReason
              ? { fallbackReason: structuralResult.fallbackReason }
              : {}),
          };
        }

        return { preChunks: chunks, avgDensity: density, structuralMeta: meta };
      },
    );

    stages.push(
      stage("chunked", "completed", chunkStageStart, new Date().toISOString(), Date.now() - chunkStarted),
    );
    await options.store.updateTraceStatus(input.traceId, "chunked", stages);
    await emitChunkingCompleted(options.events, {
      traceId: input.traceId,
      workspaceId: input.workspaceId,
      latencyMs: Date.now() - chunkStarted,
      extra: {
        chunk_count: preChunks.length,
        chunking_strategy: structuralMeta.chunkingStrategy,
        fallback_used: structuralMeta.fallbackUsed,
        average_semantic_density: avgDensity,
      },
    });

    const memory = buildCanonicalMemory({
      workspaceId: input.workspaceId,
      lineageId,
      version: 1,
      memoryType: input.memoryType,
      persistenceMode: input.persistenceMode,
      sourceType: input.sourceType,
      title: input.title ?? normalized.title,
      normalizedContent: normalized.normalizedContent,
      ingestionTraceId: input.traceId,
      normalizationTraceId,
      chunks: preChunks,
      semanticDensityScore: avgDensity,
      structuralMeta,
      ...(input.memoryId ? { memoryId: input.memoryId } : {}),
      ...(input.metadataPatch ? { metadataPatch: input.metadataPatch } : {}),
      ...(input.sourceUrl ?? input.url
        ? { sourceUrl: (input.sourceUrl ?? input.url) as string }
        : {}),
      ...(input.sourceLabel ? { sourceLabel: input.sourceLabel } : {}),
      ...(input.tags ? { tags: input.tags } : {}),
      ingestionLatencyMs: Date.now() - pipelineStarted,
      normalizationLatencyMs: Date.now() - normStarted,
    });

    await options.store.persistMemory(memory, lineageId);

    const embedStageStart = new Date().toISOString();
    const embedResult = await measurePipelineStage(
      input.traceId,
      "embedding_generation",
      timing,
      async () => embedChunks(memory.chunks, options.embeddingClient),
    );
    memory.chunks = embedResult.chunks;
    memory.observability.embeddingLatencyMs = embedResult.embeddingLatencyMs;

    await options.store.updateChunkEmbeddings(memory.id, memory.chunks);

    if (embedResult.failed) {
      stages.push(
        stage("embedded", "failed", embedStageStart, new Date().toISOString(), embedResult.embeddingLatencyMs, embedResult.error),
      );
      memory.observability.retrievalEligible = false;
      await emitEmbeddingFailed(options.events, {
        traceId: input.traceId,
        workspaceId: input.workspaceId,
        memoryId: memory.id,
        latencyMs: embedResult.embeddingLatencyMs,
        ...(embedResult.error ? { error: embedResult.error } : {}),
      });
    } else {
      stages.push(
        stage("embedded", "completed", embedStageStart, new Date().toISOString(), embedResult.embeddingLatencyMs),
      );
      await emitEmbeddingCompleted(options.events, {
        traceId: input.traceId,
        workspaceId: input.workspaceId,
        memoryId: memory.id,
        latencyMs: embedResult.embeddingLatencyMs,
      });
    }

    const finalStatus: IngestionState = embedResult.failed ? "stored" : "completed";
    stages.push(stage("stored", "completed", new Date().toISOString(), new Date().toISOString()));
    if (!embedResult.failed) {
      stages.push(stage("completed", "completed", new Date().toISOString(), new Date().toISOString()));
    }

    await options.store.updateTraceStatus(input.traceId, finalStatus, stages);
    await emitIngestionCompleted(options.events, {
      traceId: input.traceId,
      workspaceId: input.workspaceId,
      memoryId: memory.id,
      latencyMs: Date.now() - pipelineStarted,
      success: !embedResult.failed,
      extra: { embedding_degraded: embedResult.failed },
    });

    return { memory, status: finalStatus, lineageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stages.push(
      stage("failed", "failed", normStageStart, new Date().toISOString(), Date.now() - pipelineStarted, message),
    );
    await options.store.updateTraceStatus(input.traceId, "failed", stages);
    await emitIngestionCompleted(options.events, {
      traceId: input.traceId,
      workspaceId: input.workspaceId,
      latencyMs: Date.now() - pipelineStarted,
      success: false,
      error: message,
    });
    throw error;
  }
  });
}
