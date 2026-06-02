import { newUlid, type EventPayload, type EventSeverity } from "@memory-middleware/shared-types";

export interface StructuredEventInput {
  event_type: string;
  trace_id: string;
  workspace_id?: string;
  severity?: EventSeverity;
  metadata?: Record<string, unknown>;
  timestamp?: string;
}

export function createStructuredEvent(input: StructuredEventInput): EventPayload {
  const event: EventPayload = {
    event_id: newUlid(),
    event_type: input.event_type,
    timestamp: input.timestamp ?? new Date().toISOString(),
    trace_id: input.trace_id,
    severity: input.severity ?? "info",
    metadata: input.metadata ?? {},
  };

  if (input.workspace_id) {
    event.workspace_id = input.workspace_id;
  }

  return event;
}
