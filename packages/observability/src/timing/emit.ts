import type { ExecutionTimingAudit } from "@memory-middleware/shared-types";
import type { Logger } from "../logger.js";
import type { EventEmitter } from "../events/event-emitter.js";

export async function emitTimingAudit(
  logger: Logger,
  events: EventEmitter | undefined,
  audit: ExecutionTimingAudit,
  metadata?: Record<string, unknown>,
): Promise<void> {
  logger.info(
    {
      event_type: "timing.audit.completed",
      request_id: audit.requestId,
      total_latency_ms: audit.totalLatency,
      stage_count: audit.stages.length,
      stages: audit.stages,
      ...metadata,
    },
    "timing.audit.completed",
  );

  if (events) {
    await events.emit({
      event_type: "timing.audit.completed",
      trace_id: audit.requestId,
      metadata: {
        total_latency_ms: audit.totalLatency,
        stage_count: audit.stages.length,
        stages: audit.stages,
        ...metadata,
      },
    });
  }
}
