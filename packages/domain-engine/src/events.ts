import type { EventEmitter } from "@memory-middleware/observability";
import { DOMAIN_ENGINE_EVENT_TYPES } from "@memory-middleware/shared-types";

export interface DomainEngineEventContext {
  traceId: string;
  workspaceId: string;
  severity?: "info" | "warn" | "error" | "debug";
  extra?: Record<string, unknown>;
}

export async function emitDomainEngineEvent(
  events: EventEmitter,
  eventType: string,
  ctx: DomainEngineEventContext,
): Promise<void> {
  await events.emit({
    event_type: eventType,
    trace_id: ctx.traceId,
    workspace_id: ctx.workspaceId,
    severity: ctx.severity ?? "info",
    metadata: {
      operation: "domain_engine",
      ...ctx.extra,
    },
  });
}

export { DOMAIN_ENGINE_EVENT_TYPES };
