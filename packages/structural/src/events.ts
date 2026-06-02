import type { EventEmitter } from "@memory-middleware/observability";
import {
  EVOLUTION_EVENT_TYPES,
  STRUCTURAL_EVENT_TYPES,
} from "@memory-middleware/shared-types";

export interface StructuralEventContext {
  traceId: string;
  workspaceId: string;
  memoryId?: string;
  latencyMs?: number;
  extra?: Record<string, unknown>;
}

export async function emitStructureParsingCompleted(
  events: EventEmitter,
  ctx: StructuralEventContext,
): Promise<void> {
  await events.emit({
    event_type: STRUCTURAL_EVENT_TYPES.STRUCTURE_PARSING_COMPLETED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "structural",
      success: true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      ...ctx.extra,
    },
  });
}

export async function emitSemanticSegmentationCompleted(
  events: EventEmitter,
  ctx: StructuralEventContext,
): Promise<void> {
  await events.emit({
    event_type: STRUCTURAL_EVENT_TYPES.SEMANTIC_SEGMENTATION_COMPLETED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "structural",
      success: true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      ...ctx.extra,
    },
  });
}

export async function emitAdjacencyGenerationCompleted(
  events: EventEmitter,
  ctx: StructuralEventContext,
): Promise<void> {
  await events.emit({
    event_type: STRUCTURAL_EVENT_TYPES.ADJACENCY_GENERATION_COMPLETED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "structural",
      success: true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      ...ctx.extra,
    },
  });
}

export async function emitSemanticDensityScored(
  events: EventEmitter,
  ctx: StructuralEventContext,
): Promise<void> {
  await events.emit({
    event_type: STRUCTURAL_EVENT_TYPES.SEMANTIC_DENSITY_SCORED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "structural",
      success: true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      ...ctx.extra,
    },
  });
}

export async function emitStructuralFallback(
  events: EventEmitter,
  ctx: StructuralEventContext & { reason: string },
): Promise<void> {
  await events.emit({
    event_type: STRUCTURAL_EVENT_TYPES.STRUCTURAL_FALLBACK,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    severity: "warn",
    metadata: {
      operation: "structural",
      success: true,
      memory_id: ctx.memoryId,
      latency_ms: ctx.latencyMs,
      fallback_reason: ctx.reason,
      ...ctx.extra,
    },
  });
}

export async function emitReinforcementUpdated(
  events: EventEmitter,
  ctx: StructuralEventContext & { delta: number; reason: string },
): Promise<void> {
  await events.emit({
    event_type: EVOLUTION_EVENT_TYPES.REINFORCEMENT_UPDATED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "evolution",
      success: true,
      memory_id: ctx.memoryId,
      reinforcement_delta: ctx.delta,
      reason: ctx.reason,
      ...ctx.extra,
    },
  });
}

export async function emitDecayUpdated(
  events: EventEmitter,
  ctx: StructuralEventContext,
): Promise<void> {
  await events.emit({
    event_type: EVOLUTION_EVENT_TYPES.DECAY_UPDATED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "evolution",
      success: true,
      memory_id: ctx.memoryId,
      ...ctx.extra,
    },
  });
}

export async function emitArchivalTransitioned(
  events: EventEmitter,
  ctx: StructuralEventContext & { reason: string },
): Promise<void> {
  await events.emit({
    event_type: EVOLUTION_EVENT_TYPES.ARCHIVAL_TRANSITIONED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "evolution",
      success: true,
      memory_id: ctx.memoryId,
      reason: ctx.reason,
      ...ctx.extra,
    },
  });
}

export async function emitRetrievalExpansionApplied(
  events: EventEmitter,
  ctx: StructuralEventContext,
): Promise<void> {
  await events.emit({
    event_type: EVOLUTION_EVENT_TYPES.RETRIEVAL_EXPANSION_APPLIED,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    metadata: {
      operation: "retrieval_expansion",
      success: true,
      ...ctx.extra,
    },
  });
}
