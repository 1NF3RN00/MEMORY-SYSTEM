export type EventSeverity = "debug" | "info" | "warn" | "error";

/**
 * Deterministic, structured, serializable event contract.
 */
export interface EventPayload {
  event_id: string;
  event_type: string;
  timestamp: string;
  trace_id: string;
  workspace_id?: string;
  severity: EventSeverity;
  metadata: Record<string, unknown>;
}
