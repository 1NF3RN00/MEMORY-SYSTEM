import type { EventPayload } from "@memory-middleware/shared-types";
import type { Logger } from "../logger.js";
import { createStructuredEvent, type StructuredEventInput } from "./event-factory.js";

export interface EventSink {
  persist(event: EventPayload): Promise<void>;
}

export interface EventEmitter {
  emit(input: StructuredEventInput): Promise<EventPayload>;
}

export interface LoggingEventEmitterOptions {
  logger: Logger;
  sink?: EventSink;
}

export function createLoggingEventEmitter(
  options: LoggingEventEmitterOptions,
): EventEmitter {
  const { logger, sink } = options;

  return {
    async emit(input: StructuredEventInput): Promise<EventPayload> {
      const event = createStructuredEvent(input);

      logger.info(
        {
          event_id: event.event_id,
          event_type: event.event_type,
          trace_id: event.trace_id,
          workspace_id: event.workspace_id,
          severity: event.severity,
          metadata: event.metadata,
        },
        "event.emitted",
      );

      if (sink) {
        await sink.persist(event);
      }

      return event;
    },
  };
}
