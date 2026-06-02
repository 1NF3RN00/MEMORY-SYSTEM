import type { EventEmitter } from "@memory-middleware/observability";
import { COMPRESSION_EVENT_TYPES } from "@memory-middleware/shared-types";

export interface CompressionEventContext {
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
  ctx: CompressionEventContext,
): Promise<void> {
  await events.emit({
    event_type: eventType,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    severity: ctx.success === false ? "error" : "info",
    metadata: {
      operation: "compression",
      success: ctx.success ?? true,
      latency_ms: ctx.latencyMs,
      error: ctx.error,
      ...ctx.extra,
    },
  });
}

export async function emitCompressionStarted(
  events: EventEmitter,
  ctx: CompressionEventContext,
): Promise<void> {
  await emit(events, COMPRESSION_EVENT_TYPES.COMPRESSION_STARTED, ctx);
}

export async function emitOverlapDetectionCompleted(
  events: EventEmitter,
  ctx: CompressionEventContext,
): Promise<void> {
  await emit(events, COMPRESSION_EVENT_TYPES.OVERLAP_DETECTION_COMPLETED, ctx);
}

export async function emitMergeCompleted(
  events: EventEmitter,
  ctx: CompressionEventContext,
): Promise<void> {
  await emit(events, COMPRESSION_EVENT_TYPES.MERGE_COMPLETED, ctx);
}

export async function emitTrimmingCompleted(
  events: EventEmitter,
  ctx: CompressionEventContext,
): Promise<void> {
  await emit(events, COMPRESSION_EVENT_TYPES.TRIMMING_COMPLETED, ctx);
}

export async function emitAbstractionCompleted(
  events: EventEmitter,
  ctx: CompressionEventContext,
): Promise<void> {
  await emit(events, COMPRESSION_EVENT_TYPES.ABSTRACTION_COMPLETED, ctx);
}

export async function emitFidelityValidationCompleted(
  events: EventEmitter,
  ctx: CompressionEventContext,
): Promise<void> {
  await emit(events, COMPRESSION_EVENT_TYPES.FIDELITY_VALIDATION_COMPLETED, ctx);
}

export async function emitCompressionCompleted(
  events: EventEmitter,
  ctx: CompressionEventContext,
): Promise<void> {
  await emit(events, COMPRESSION_EVENT_TYPES.COMPRESSION_COMPLETED, ctx);
}

export async function emitCompressionFailed(
  events: EventEmitter,
  ctx: CompressionEventContext,
): Promise<void> {
  await emit(events, COMPRESSION_EVENT_TYPES.COMPRESSION_FAILED, {
    ...ctx,
    success: false,
  });
}
