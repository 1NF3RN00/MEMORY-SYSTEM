import type { EventPayload } from "@memory-middleware/shared-types";
import {
  createLoggingEventEmitter,
  type EventEmitter,
  type EventSink,
  type Logger,
} from "@memory-middleware/observability";

export type EventListener = (event: EventPayload) => void;

export interface SubscribableEventEmitter extends EventEmitter {
  subscribe(listener: EventListener): () => void;
}

export function createSubscribableEventEmitter(options: {
  logger: Logger;
  sink?: EventSink;
}): SubscribableEventEmitter {
  const listeners = new Set<EventListener>();
  const inner = createLoggingEventEmitter(options);

  return {
    async emit(input) {
      const event = await inner.emit(input);
      for (const listener of listeners) {
        try {
          listener(event);
        } catch {
          // Subscriber failures must not block emission.
        }
      }
      return event;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
