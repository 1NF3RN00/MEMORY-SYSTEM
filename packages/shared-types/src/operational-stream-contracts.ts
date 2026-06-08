/**
 * Sprint-25 operational stream contracts.
 *
 * GET /workspaces/:workspaceId/operational-stream (SSE)
 *
 * Pushes incremental home stream events so the dashboard avoids refetching the
 * full dashboard-bootstrap bundle on every poll cycle.
 */

export type OperationalStreamEnvelopeKind =
  | "connected"
  | "event"
  | "heartbeat"
  | "error";

export type OperationalStreamEventCategory =
  | "INGESTION"
  | "RETRIEVAL"
  | "REINFORCEMENT"
  | "COMPRESSION"
  | "MEMORY_HEALTH";

/** Serializable stream event — dashboard maps `timestamp` to `Date`. */
export interface OperationalStreamEventPayload {
  id: string;
  category: OperationalStreamEventCategory;
  title: string;
  detail: string;
  timestamp: string;
  metadata?: Record<string, string>;
  lineage?: string;
  source?: string;
}

export interface OperationalStreamEnvelope {
  kind: OperationalStreamEnvelopeKind;
  workspaceId: string;
  traceId: string;
  sequence: number;
  timestamp: string;
  event?: OperationalStreamEventPayload;
  message?: string;
}

/** SSE route path suffix — used by dashboard client and auth middleware. */
export const OPERATIONAL_STREAM_PATH_SUFFIX = "/operational-stream";
