import type { EventEmitter } from "@memory-middleware/observability";
import { OBSERVATION_EVENT_TYPES } from "@memory-middleware/shared-types";

export interface ObservationEventContext {
  traceId: string;
  workspaceId: string;
  observationId: string;
  provider: string;
  category: string;
  metric: string;
  extra?: Record<string, unknown>;
}

export async function emitObservationEvent(
  events: EventEmitter,
  eventType: string,
  ctx: ObservationEventContext,
): Promise<void> {
  await events.emit({
    event_type: eventType,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    severity: "info",
    metadata: {
      operation: "observation",
      observation_id: ctx.observationId,
      provider: ctx.provider,
      category: ctx.category,
      metric: ctx.metric,
      ...ctx.extra,
    },
  });
}

export { OBSERVATION_EVENT_TYPES };
