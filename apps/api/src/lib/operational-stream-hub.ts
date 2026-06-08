import { newUlid, type EventPayload, type OperationalStreamEnvelope } from "@memory-middleware/shared-types";
import type { SubscribableEventEmitter } from "./subscribable-event-emitter.js";
import { mapEventPayloadToStreamEvent } from "./operational-stream-mapper.js";

export type OperationalStreamSubscriber = {
  workspaceId: string;
  traceId: string;
  push: (envelope: OperationalStreamEnvelope) => boolean;
};

const HEARTBEAT_INTERVAL_MS = 30_000;

export class OperationalStreamHub {
  private readonly subscribers = new Map<string, Set<OperationalStreamSubscriber>>();
  private readonly sequences = new Map<string, number>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly unsubscribeEmitter: () => void;

  constructor(private readonly events: SubscribableEventEmitter) {
    this.unsubscribeEmitter = events.subscribe((event) => this.handleEvent(event));
    this.heartbeatTimer = setInterval(() => this.broadcastHeartbeats(), HEARTBEAT_INTERVAL_MS);
    if (typeof this.heartbeatTimer.unref === "function") {
      this.heartbeatTimer.unref();
    }
  }

  subscribe(subscriber: OperationalStreamSubscriber): () => void {
    const bucket = this.subscribers.get(subscriber.workspaceId) ?? new Set();
    bucket.add(subscriber);
    this.subscribers.set(subscriber.workspaceId, bucket);

    const connected = this.nextEnvelope(subscriber.workspaceId, subscriber.traceId, "connected");
    subscriber.push(connected);

    return () => {
      const current = this.subscribers.get(subscriber.workspaceId);
      if (!current) return;
      current.delete(subscriber);
      if (current.size === 0) {
        this.subscribers.delete(subscriber.workspaceId);
        this.sequences.delete(subscriber.workspaceId);
      }
    };
  }

  dispose(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    this.unsubscribeEmitter();
    this.subscribers.clear();
    this.sequences.clear();
  }

  private handleEvent(event: EventPayload): void {
    const workspaceId = event.workspace_id;
    if (!workspaceId) return;

    const subscribers = this.subscribers.get(workspaceId);
    if (!subscribers || subscribers.size === 0) return;

    const streamEvent = mapEventPayloadToStreamEvent(event);
    if (!streamEvent) return;

    const envelope = this.nextEnvelope(workspaceId, event.trace_id, "event", {
      event: streamEvent,
    });

    for (const subscriber of subscribers) {
      const delivered = subscriber.push(envelope);
      if (!delivered) {
        subscribers.delete(subscriber);
      }
    }
  }

  private broadcastHeartbeats(): void {
    for (const [workspaceId, subscribers] of this.subscribers) {
      if (subscribers.size === 0) continue;
      const traceId = newUlid();
      const envelope = this.nextEnvelope(workspaceId, traceId, "heartbeat");
      for (const subscriber of [...subscribers]) {
        const delivered = subscriber.push(envelope);
        if (!delivered) {
          subscribers.delete(subscriber);
        }
      }
    }
  }

  private nextEnvelope(
    workspaceId: string,
    traceId: string,
    kind: OperationalStreamEnvelope["kind"],
    extra?: Pick<OperationalStreamEnvelope, "event" | "message">,
  ): OperationalStreamEnvelope {
    const sequence = (this.sequences.get(workspaceId) ?? 0) + 1;
    this.sequences.set(workspaceId, sequence);

    return {
      kind,
      workspaceId,
      traceId,
      sequence,
      timestamp: new Date().toISOString(),
      ...extra,
    };
  }
}

export function createOperationalStreamHub(
  events: SubscribableEventEmitter,
): OperationalStreamHub {
  return new OperationalStreamHub(events);
}
