import type { EventEmitter } from "@memory-middleware/observability";
import { RETRIEVAL_EVENT_TYPES } from "@memory-middleware/shared-types";

export interface RetrievalEventContext {
  traceId: string;
  workspaceId: string;
  latencyMs?: number;
  success?: boolean;
  error?: string;
  extra?: Record<string, unknown>;
}

async function emit(
  events: EventEmitter,
  eventType: string,
  ctx: RetrievalEventContext,
): Promise<void> {
  await events.emit({
    event_type: eventType,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    severity: ctx.success === false ? "error" : "info",
    metadata: {
      operation: "retrieval",
      success: ctx.success ?? true,
      latency_ms: ctx.latencyMs,
      error: ctx.error,
      ...ctx.extra,
    },
  });
}

export async function emitRetrievalStarted(
  events: EventEmitter,
  ctx: RetrievalEventContext,
): Promise<void> {
  await emit(events, RETRIEVAL_EVENT_TYPES.RETRIEVAL_STARTED, ctx);
}

export async function emitPreprocessingCompleted(
  events: EventEmitter,
  ctx: RetrievalEventContext,
): Promise<void> {
  await emit(events, RETRIEVAL_EVENT_TYPES.PREPROCESSING_COMPLETED, ctx);
}

export async function emitVectorRetrievalCompleted(
  events: EventEmitter,
  ctx: RetrievalEventContext,
): Promise<void> {
  await emit(events, RETRIEVAL_EVENT_TYPES.VECTOR_RETRIEVAL_COMPLETED, ctx);
}

export async function emitRerankingCompleted(
  events: EventEmitter,
  ctx: RetrievalEventContext,
): Promise<void> {
  await emit(events, RETRIEVAL_EVENT_TYPES.RERANKING_COMPLETED, ctx);
}

export async function emitDeduplicationCompleted(
  events: EventEmitter,
  ctx: RetrievalEventContext,
): Promise<void> {
  await emit(events, RETRIEVAL_EVENT_TYPES.DEDUPLICATION_COMPLETED, ctx);
}

export async function emitTokenBudgetingCompleted(
  events: EventEmitter,
  ctx: RetrievalEventContext,
): Promise<void> {
  await emit(events, RETRIEVAL_EVENT_TYPES.TOKEN_BUDGETING_COMPLETED, ctx);
}

export async function emitContextAssemblyCompleted(
  events: EventEmitter,
  ctx: RetrievalEventContext,
): Promise<void> {
  await emit(events, RETRIEVAL_EVENT_TYPES.CONTEXT_ASSEMBLY_COMPLETED, ctx);
}

export async function emitRetrievalCompleted(
  events: EventEmitter,
  ctx: RetrievalEventContext,
): Promise<void> {
  await emit(events, RETRIEVAL_EVENT_TYPES.RETRIEVAL_COMPLETED, ctx);
}

export async function emitRetrievalFailed(
  events: EventEmitter,
  ctx: RetrievalEventContext,
): Promise<void> {
  await emit(events, RETRIEVAL_EVENT_TYPES.RETRIEVAL_FAILED, {
    ...ctx,
    success: false,
  });
}
