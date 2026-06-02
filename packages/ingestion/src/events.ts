import type { EventEmitter } from "@memory-middleware/observability";
import { INGESTION_EVENT_TYPES } from "@memory-middleware/shared-types";

export interface IngestionEventContext {
  traceId: string;
  workspaceId: string;
  memoryId?: string;
  latencyMs?: number;
  success?: boolean;
  error?: string;
  extra?: Record<string, unknown>;
}

export async function emitIngestionStarted(
  events: EventEmitter,
  ctx: IngestionEventContext,
): Promise<void> {
  await events.emit({
    event_type: INGESTION_EVENT_TYPES.INGESTION_STARTED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "ingestion",
      success: true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      ...ctx.extra,
    },
  });
}

export async function emitNormalizationCompleted(
  events: EventEmitter,
  ctx: IngestionEventContext,
): Promise<void> {
  await events.emit({
    event_type: INGESTION_EVENT_TYPES.NORMALIZATION_COMPLETED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "normalization",
      success: ctx.success ?? true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      error: ctx.error,
      ...ctx.extra,
    },
  });
}

export async function emitChunkingCompleted(
  events: EventEmitter,
  ctx: IngestionEventContext,
): Promise<void> {
  await events.emit({
    event_type: INGESTION_EVENT_TYPES.CHUNKING_COMPLETED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "chunking",
      success: true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      ...ctx.extra,
    },
  });
}

export async function emitEmbeddingCompleted(
  events: EventEmitter,
  ctx: IngestionEventContext,
): Promise<void> {
  await events.emit({
    event_type: INGESTION_EVENT_TYPES.EMBEDDING_COMPLETED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "embedding",
      success: true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      ...ctx.extra,
    },
  });
}

export async function emitEmbeddingFailed(
  events: EventEmitter,
  ctx: IngestionEventContext,
): Promise<void> {
  await events.emit({
    event_type: INGESTION_EVENT_TYPES.EMBEDDING_FAILED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    severity: "warn",
    metadata: {
      operation: "embedding",
      success: false,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      error: ctx.error,
      ...ctx.extra,
    },
  });
}

export async function emitIngestionCompleted(
  events: EventEmitter,
  ctx: IngestionEventContext,
): Promise<void> {
  await events.emit({
    event_type: INGESTION_EVENT_TYPES.INGESTION_COMPLETED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "ingestion",
      success: ctx.success ?? true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      error: ctx.error,
      ...ctx.extra,
    },
  });
}
