import type { EventEmitter } from "@memory-middleware/observability";
import { PLANNING_EVENT_TYPES } from "@memory-middleware/shared-types";

export interface PlanningEventContext {
  planId: string;
  workspaceId: string;
  latencyMs?: number;
  error?: string;
  extra?: Record<string, unknown>;
}

async function emit(
  events: EventEmitter | undefined,
  eventType: string,
  ctx: PlanningEventContext,
  success = true,
): Promise<void> {
  if (!events) return;
  await events.emit({
    event_type: eventType,
    trace_id: ctx.planId,
    workspace_id: ctx.workspaceId,
    severity: success ? "info" : "error",
    metadata: {
      operation: "retrieval_planning",
      success,
      latency_ms: ctx.latencyMs,
      error: ctx.error,
      ...ctx.extra,
    },
  });
}

export async function emitDecompositionCompleted(
  events: EventEmitter | undefined,
  ctx: PlanningEventContext,
): Promise<void> {
  await emit(events, PLANNING_EVENT_TYPES.DECOMPOSITION_COMPLETED, ctx);
}

export async function emitMetadataExpansionCompleted(
  events: EventEmitter | undefined,
  ctx: PlanningEventContext,
): Promise<void> {
  await emit(events, PLANNING_EVENT_TYPES.METADATA_EXPANSION_COMPLETED, ctx);
}

export async function emitRetrievalPlanGenerated(
  events: EventEmitter | undefined,
  ctx: PlanningEventContext,
): Promise<void> {
  await emit(events, PLANNING_EVENT_TYPES.RETRIEVAL_PLAN_GENERATED, ctx);
}

export async function emitWeightingApplied(
  events: EventEmitter | undefined,
  ctx: PlanningEventContext,
): Promise<void> {
  await emit(events, PLANNING_EVENT_TYPES.WEIGHTING_APPLIED, ctx);
}

export async function emitRetrievalModeActivated(
  events: EventEmitter | undefined,
  ctx: PlanningEventContext,
): Promise<void> {
  await emit(events, PLANNING_EVENT_TYPES.RETRIEVAL_MODE_ACTIVATED, ctx);
}

export async function emitPlanningFailed(
  events: EventEmitter | undefined,
  ctx: PlanningEventContext,
): Promise<void> {
  await emit(events, PLANNING_EVENT_TYPES.PLANNING_FAILED, ctx, false);
}

export async function emitModeTuningCompleted(
  events: EventEmitter | undefined,
  ctx: PlanningEventContext,
): Promise<void> {
  await emit(events, PLANNING_EVENT_TYPES.MODE_TUNING_COMPLETED, ctx);
}

export async function emitBenchmarkCompleted(
  events: EventEmitter | undefined,
  ctx: PlanningEventContext,
): Promise<void> {
  await emit(events, PLANNING_EVENT_TYPES.BENCHMARK_COMPLETED, ctx);
}
