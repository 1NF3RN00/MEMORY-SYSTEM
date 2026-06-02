import type { EventEmitter } from "@memory-middleware/observability";
import { CONTEXT_DELIVERY_EVENT_TYPES } from "@memory-middleware/shared-types";

export interface ContextDeliveryEventContext {
  deliveryId: string;
  workspaceId: string;
  retrievalTraceId: string;
  latencyMs?: number;
  success?: boolean;
  error?: string;
  extra?: Record<string, unknown>;
}

async function emit(
  events: EventEmitter,
  eventType: string,
  ctx: ContextDeliveryEventContext,
): Promise<void> {
  await events.emit({
    event_type: eventType,
    trace_id: ctx.deliveryId,
    workspace_id: ctx.workspaceId,
    severity: ctx.success === false ? "error" : "info",
    metadata: {
      operation: "context_delivery",
      retrieval_trace_id: ctx.retrievalTraceId,
      success: ctx.success ?? true,
      latency_ms: ctx.latencyMs,
      error: ctx.error,
      ...ctx.extra,
    },
  });
}

export async function emitRenderingStarted(
  events: EventEmitter,
  ctx: ContextDeliveryEventContext,
): Promise<void> {
  await emit(events, CONTEXT_DELIVERY_EVENT_TYPES.RENDERING_STARTED, ctx);
}

export async function emitGroupingCompleted(
  events: EventEmitter,
  ctx: ContextDeliveryEventContext,
): Promise<void> {
  await emit(events, CONTEXT_DELIVERY_EVENT_TYPES.GROUPING_COMPLETED, ctx);
}

export async function emitTraceStrippingCompleted(
  events: EventEmitter,
  ctx: ContextDeliveryEventContext,
): Promise<void> {
  await emit(events, CONTEXT_DELIVERY_EVENT_TYPES.TRACE_STRIPPING_COMPLETED, ctx);
}

export async function emitDeliveryGenerated(
  events: EventEmitter,
  ctx: ContextDeliveryEventContext,
): Promise<void> {
  await emit(events, CONTEXT_DELIVERY_EVENT_TYPES.DELIVERY_GENERATED, ctx);
}

export async function emitTokenOptimizationCompleted(
  events: EventEmitter,
  ctx: ContextDeliveryEventContext,
): Promise<void> {
  await emit(events, CONTEXT_DELIVERY_EVENT_TYPES.TOKEN_OPTIMIZATION_COMPLETED, ctx);
}

export async function emitRenderingFailed(
  events: EventEmitter,
  ctx: ContextDeliveryEventContext,
): Promise<void> {
  await emit(events, CONTEXT_DELIVERY_EVENT_TYPES.RENDERING_FAILED, {
    ...ctx,
    success: false,
  });
}
