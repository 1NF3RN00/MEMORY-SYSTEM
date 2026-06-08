import type {
  OperationalStreamEnvelope,
  OperationalStreamEventPayload,
} from "@memory-middleware/shared-types";
import { API_BASE } from "./api.js";
import type { OperationalEvent } from "../components/homepage/types.js";

export type OperationalStreamConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

const MAX_STREAM_EVENTS = 24;
const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

function streamUrl(workspaceId: string, accessToken: string | null): string {
  const base = API_BASE ? `${API_BASE}` : "";
  const params = new URLSearchParams();
  if (accessToken) {
    params.set("access_token", accessToken);
  }
  const query = params.toString();
  return `${base}/workspaces/${workspaceId}/operational-stream${query ? `?${query}` : ""}`;
}

export function operationalEventFromStreamPayload(
  payload: OperationalStreamEventPayload,
): OperationalEvent {
  return {
    id: payload.id,
    category: payload.category,
    title: payload.title,
    detail: payload.detail,
    timestamp: new Date(payload.timestamp),
    ...(payload.metadata ? { metadata: payload.metadata } : {}),
    ...(payload.lineage ? { lineage: payload.lineage } : {}),
    ...(payload.source ? { source: payload.source } : {}),
  };
}

export function mergeOperationalStreamEvents(
  baseline: OperationalEvent[],
  pushed: OperationalEvent[],
): OperationalEvent[] {
  if (pushed.length === 0) return baseline;

  const seen = new Set<string>();
  const merged: OperationalEvent[] = [];

  for (const event of [...pushed, ...baseline]) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    merged.push(event);
  }

  return merged
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, MAX_STREAM_EVENTS);
}

export interface OperationalStreamSubscription {
  close: () => void;
}

export function subscribeOperationalStream(options: {
  workspaceId: string;
  accessToken: string | null;
  enabled: boolean;
  onEnvelope: (envelope: OperationalStreamEnvelope) => void;
  onStatus: (status: OperationalStreamConnectionStatus) => void;
}): OperationalStreamSubscription {
  const { workspaceId, accessToken, enabled, onEnvelope, onStatus } = options;

  if (!enabled || !workspaceId) {
    onStatus("idle");
    return { close: () => undefined };
  }

  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = INITIAL_RECONNECT_MS;
  let closed = false;

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed) return;
    clearReconnect();
    onStatus("disconnected");
    reconnectTimer = setTimeout(() => {
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_MS);
      connect();
    }, reconnectDelay);
  };

  const connect = () => {
    if (closed) return;
    clearReconnect();
    onStatus("connecting");

    if (source) {
      source.close();
      source = null;
    }

    try {
      source = new EventSource(streamUrl(workspaceId, accessToken));
    } catch {
      onStatus("error");
      scheduleReconnect();
      return;
    }

    source.onopen = () => {
      reconnectDelay = INITIAL_RECONNECT_MS;
      onStatus("connected");
    };

    source.onmessage = (message) => {
      try {
        const envelope = JSON.parse(message.data) as OperationalStreamEnvelope;
        onEnvelope(envelope);
        if (envelope.kind === "error") {
          onStatus("error");
        }
      } catch {
        onStatus("error");
      }
    };

    source.onerror = () => {
      source?.close();
      source = null;
      scheduleReconnect();
    };
  };

  connect();

  return {
    close() {
      closed = true;
      clearReconnect();
      source?.close();
      source = null;
      onStatus("idle");
    },
  };
}

/** Poll interval when SSE is connected — events arrive via push (Sprint-25). */
export const TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS = 60_000;
