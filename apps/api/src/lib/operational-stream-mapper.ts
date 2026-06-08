import {
  COMPRESSION_EVENT_TYPES,
  HISTORIAN_EVENT_TYPES,
  INGESTION_EVENT_TYPES,
  RETRIEVAL_EVENT_TYPES,
  type EventPayload,
  type OperationalStreamEventPayload,
} from "@memory-middleware/shared-types";

const STREAM_EVENT_TYPES = new Set<string>([
  INGESTION_EVENT_TYPES.INGESTION_COMPLETED,
  RETRIEVAL_EVENT_TYPES.RETRIEVAL_COMPLETED,
  RETRIEVAL_EVENT_TYPES.RETRIEVAL_FAILED,
  COMPRESSION_EVENT_TYPES.COMPRESSION_COMPLETED,
  COMPRESSION_EVENT_TYPES.COMPRESSION_FAILED,
  HISTORIAN_EVENT_TYPES.DRIFT_DETECTED,
]);

function metadataString(
  metadata: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = metadata[key];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | undefined {
  const value = metadata[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
}

export function isOperationalStreamSourceEvent(event: EventPayload): boolean {
  return STREAM_EVENT_TYPES.has(event.event_type);
}

export function mapEventPayloadToStreamEvent(
  event: EventPayload,
): OperationalStreamEventPayload | null {
  if (!isOperationalStreamSourceEvent(event)) return null;

  const metadata = event.metadata ?? {};
  const traceId = event.trace_id;
  const timestamp = event.timestamp;

  switch (event.event_type) {
    case INGESTION_EVENT_TYPES.INGESTION_COMPLETED: {
      const memoryId = metadataString(metadata, "memory_id");
      const success = metadata.success !== false;
      const sourceType = metadataString(metadata, "source_type");
      return {
        id: `ing-${traceId}`,
        category: "INGESTION",
        title: success ? "Ingestion completed" : "Ingestion failed",
        detail: memoryId ? `Memory ${memoryId.slice(0, 12)}…` : sourceType ?? "—",
        timestamp,
        metadata: {
          trace: traceId.slice(0, 12),
          source: sourceType ?? "—",
        },
        lineage: "ingest → normalize → chunk",
        source: memoryId ?? traceId,
      };
    }
    case RETRIEVAL_EVENT_TYPES.RETRIEVAL_COMPLETED:
    case RETRIEVAL_EVENT_TYPES.RETRIEVAL_FAILED: {
      const query = metadataString(metadata, "query");
      const status =
        event.event_type === RETRIEVAL_EVENT_TYPES.RETRIEVAL_FAILED ? "failed" : "completed";
      const latencyMs = metadataNumber(metadata, "latency_ms");
      return {
        id: `ret-${traceId}`,
        category: "RETRIEVAL",
        title: query ? query.slice(0, 64) : "Retrieval executed",
        detail: `${status}${latencyMs ? ` · ${latencyMs}ms` : ""}`,
        timestamp,
        metadata: {
          trace: traceId.slice(0, 12),
          status,
        },
        lineage: "vector → rerank → dedup → assemble",
        source: traceId,
      };
    }
    case COMPRESSION_EVENT_TYPES.COMPRESSION_COMPLETED:
    case COMPRESSION_EVENT_TYPES.COMPRESSION_FAILED: {
      const status =
        event.event_type === COMPRESSION_EVENT_TYPES.COMPRESSION_FAILED ? "failed" : "completed";
      return {
        id: `cmp-${traceId}`,
        category: "COMPRESSION",
        title: `Compression ${status}`,
        detail: traceId.slice(0, 16),
        timestamp,
        metadata: { trace: traceId.slice(0, 12) },
        lineage: "overlap → merge → trim",
        source: traceId,
      };
    }
    case HISTORIAN_EVENT_TYPES.DRIFT_DETECTED: {
      const description =
        metadataString(metadata, "description") ??
        metadataString(metadata, "signal_type") ??
        "Drift signal detected";
      const signalType = metadataString(metadata, "signal_type") ?? "drift";
      return {
        id: `drift-${event.event_id}`,
        category: "MEMORY_HEALTH",
        title: description.slice(0, 72),
        detail: signalType.replace(/_/g, " "),
        timestamp,
        metadata: { type: signalType },
        lineage: "historian → drift scan",
        source: "operational historian",
      };
    }
    default:
      return null;
  }
}
