import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INGESTION_EVENT_TYPES,
  type EventPayload,
  type OperationalStreamEnvelope,
} from "@memory-middleware/shared-types";
import { createOperationalStreamHub } from "./operational-stream-hub.js";
import { createSubscribableEventEmitter } from "./subscribable-event-emitter.js";
import { createLogger } from "@memory-middleware/observability";

describe("Sprint-25 — operational stream hub", () => {
  it("scopes pushed envelopes to the subscribed workspace", async () => {
    const events = createSubscribableEventEmitter({
      logger: createLogger({ level: "silent", service: "test" }),
    });
    const hub = createOperationalStreamHub(events);
    const received: OperationalStreamEnvelope[] = [];

    const unsubscribe = hub.subscribe({
      workspaceId: "ws-a",
      traceId: "trace-subscriber",
      push(envelope) {
        received.push(envelope);
        return true;
      },
    });

    assert.equal(received[0]?.kind, "connected");
    assert.equal(received[0]?.workspaceId, "ws-a");

    await events.emit({
      event_type: INGESTION_EVENT_TYPES.INGESTION_COMPLETED,
      trace_id: "trace-ingest-b",
      workspace_id: "ws-b",
      metadata: { memory_id: "mem-other", success: true },
    });

    assert.equal(received.length, 1);

    await events.emit({
      event_type: INGESTION_EVENT_TYPES.INGESTION_COMPLETED,
      trace_id: "trace-ingest-a",
      workspace_id: "ws-a",
      metadata: { memory_id: "mem-local", success: true },
    });

    assert.equal(received.length, 2);
    assert.equal(received[1]?.kind, "event");
    assert.equal(received[1]?.event?.category, "INGESTION");

    unsubscribe();
    hub.dispose();
  });

  it("does not silently drop delivery failures — subscriber is removed", async () => {
    const events = createSubscribableEventEmitter({
      logger: createLogger({ level: "silent", service: "test" }),
    });
    const hub = createOperationalStreamHub(events);
    let pushCalls = 0;

    hub.subscribe({
      workspaceId: "ws-drop",
      traceId: "trace-drop",
      push() {
        pushCalls += 1;
        return false;
      },
    });

    const callsAfterSubscribe = pushCalls;
    assert.equal(callsAfterSubscribe, 1);

    await events.emit({
      event_type: INGESTION_EVENT_TYPES.INGESTION_COMPLETED,
      trace_id: "trace-drop-ingest-1",
      workspace_id: "ws-drop",
      metadata: { success: true },
    });

    const callsAfterFirstEvent = pushCalls;
    assert.equal(callsAfterFirstEvent, callsAfterSubscribe + 1);

    await events.emit({
      event_type: INGESTION_EVENT_TYPES.INGESTION_COMPLETED,
      trace_id: "trace-drop-ingest-2",
      workspace_id: "ws-drop",
      metadata: { success: true },
    });

    assert.equal(pushCalls, callsAfterFirstEvent);
    hub.dispose();
  });

  it("delivers events to many concurrent subscribers on the same workspace", async () => {
    const events = createSubscribableEventEmitter({
      logger: createLogger({ level: "silent", service: "test" }),
    });
    const hub = createOperationalStreamHub(events);
    const subscriberCount = 50;
    const received: OperationalStreamEnvelope[][] = [];
    const unsubscribes: (() => void)[] = [];

    for (let i = 0; i < subscriberCount; i += 1) {
      const bucket: OperationalStreamEnvelope[] = [];
      received.push(bucket);
      unsubscribes.push(
        hub.subscribe({
          workspaceId: "ws-load",
          traceId: `trace-${i}`,
          push(envelope) {
            bucket.push(envelope);
            return true;
          },
        }),
      );
    }

    await events.emit({
      event_type: INGESTION_EVENT_TYPES.INGESTION_COMPLETED,
      trace_id: "trace-load-event",
      workspace_id: "ws-load",
      metadata: { success: true },
    });

    assert.equal(
      received.filter((bucket) => bucket.some((envelope) => envelope.kind === "event")).length,
      subscriberCount,
    );

    for (const unsubscribe of unsubscribes) {
      unsubscribe();
    }
    hub.dispose();
  });
});
