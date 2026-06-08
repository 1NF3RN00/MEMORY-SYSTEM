import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COMPRESSION_EVENT_TYPES,
  HISTORIAN_EVENT_TYPES,
  INGESTION_EVENT_TYPES,
  RETRIEVAL_EVENT_TYPES,
  type EventPayload,
} from "@memory-middleware/shared-types";
import {
  isOperationalStreamSourceEvent,
  mapEventPayloadToStreamEvent,
} from "./operational-stream-mapper.js";

function fixture(overrides: Partial<EventPayload>): EventPayload {
  return {
    event_id: "01JEVENT0000000000000000000",
    event_type: INGESTION_EVENT_TYPES.INGESTION_COMPLETED,
    timestamp: "2026-06-08T12:00:00.000Z",
    trace_id: "01JTRACE0000000000000000000",
    workspace_id: "ws-test",
    severity: "info",
    metadata: {},
    ...overrides,
  };
}

describe("Sprint-25 — operational stream mapper", () => {
  it("accepts pipeline completion events only", () => {
    assert.equal(isOperationalStreamSourceEvent(fixture({})), true);
    assert.equal(
      isOperationalStreamSourceEvent(
        fixture({ event_type: RETRIEVAL_EVENT_TYPES.RETRIEVAL_STARTED }),
      ),
      false,
    );
  });

  it("maps ingestion completion to stream event envelope payload", () => {
    const mapped = mapEventPayloadToStreamEvent(
      fixture({
        metadata: {
          memory_id: "mem-abcdefghijklmnop",
          source_type: "upload",
          success: true,
        },
      }),
    );
    assert.ok(mapped);
    assert.equal(mapped?.category, "INGESTION");
    assert.equal(mapped?.id, "ing-01JTRACE0000000000000000000");
    assert.match(mapped?.detail ?? "", /Memory mem-abcdefgh/);
  });

  it("maps retrieval failure with status metadata", () => {
    const mapped = mapEventPayloadToStreamEvent(
      fixture({
        event_type: RETRIEVAL_EVENT_TYPES.RETRIEVAL_FAILED,
        metadata: { latency_ms: 128 },
      }),
    );
    assert.ok(mapped);
    assert.equal(mapped?.category, "RETRIEVAL");
    assert.match(mapped?.detail ?? "", /failed/);
    assert.equal(mapped?.metadata?.status, "failed");
  });

  it("maps compression and drift events", () => {
    const compression = mapEventPayloadToStreamEvent(
      fixture({ event_type: COMPRESSION_EVENT_TYPES.COMPRESSION_COMPLETED }),
    );
    assert.equal(compression?.category, "COMPRESSION");

    const drift = mapEventPayloadToStreamEvent(
      fixture({
        event_type: HISTORIAN_EVENT_TYPES.DRIFT_DETECTED,
        metadata: {
          signal_type: "stale_strategic_memory",
          description: "Strategic memory stale beyond threshold",
        },
      }),
    );
    assert.equal(drift?.category, "MEMORY_HEALTH");
    assert.match(drift?.title ?? "", /Strategic memory stale/);
  });
});
