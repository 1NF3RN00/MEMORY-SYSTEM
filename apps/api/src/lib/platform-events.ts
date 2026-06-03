import type { Prisma, PrismaClient } from "@prisma/client";
import type { EventEmitter } from "@memory-middleware/observability";
import { newUlid, PLATFORM_EVENT_TYPES } from "@memory-middleware/shared-types";

export async function recordSecurityEvent(
  prisma: PrismaClient,
  input: {
    workspaceId?: string;
    eventType: string;
    severity?: string;
    actorUserId?: string;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      id: newUlid(),
      eventType: input.eventType,
      severity: input.severity ?? "warn",
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      ...(input.workspaceId ? { workspaceId: input.workspaceId } : {}),
      ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
    },
  });
}

export async function emitPlatformEvent(
  events: EventEmitter,
  input: {
    eventType: string;
    traceId: string;
    workspaceId?: string;
    severity?: "debug" | "info" | "warn" | "error";
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const payload: Parameters<EventEmitter["emit"]>[0] = {
    event_type: input.eventType,
    trace_id: input.traceId,
    severity: input.severity ?? "info",
    metadata: input.metadata ?? {},
  };
  if (input.workspaceId) payload.workspace_id = input.workspaceId;
  await events.emit(payload);
}

export { PLATFORM_EVENT_TYPES };
