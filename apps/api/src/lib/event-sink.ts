import type { EventPayload } from "@memory-middleware/shared-types";
import type { EventSink } from "@memory-middleware/observability";
import { Prisma, type PrismaClient } from "@prisma/client";

export function createPrismaEventSink(prisma: PrismaClient): EventSink {
  return {
    async persist(event: EventPayload): Promise<void> {
      const payload = JSON.parse(JSON.stringify(event)) as Prisma.InputJsonValue;

      await prisma.eventLog.create({
        data: {
          eventType: event.event_type,
          traceId: event.trace_id,
          severity: event.severity,
          payload,
          ...(event.workspace_id ? { workspaceId: event.workspace_id } : {}),
          timestamp: new Date(event.timestamp),
        },
      });
    },
  };
}
