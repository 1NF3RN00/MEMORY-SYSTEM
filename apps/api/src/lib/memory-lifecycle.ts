import type { PrismaClient } from "@prisma/client";
import type { EventEmitter } from "@memory-middleware/observability";
import type {
  MemoryArchiveResponse,
  MemoryDeleteResponse,
} from "@memory-middleware/shared-types";
import { MEMORY_LIFECYCLE_EVENT_TYPES } from "@memory-middleware/shared-types";

export async function archiveMemory(
  prisma: PrismaClient,
  events: EventEmitter,
  memoryId: string,
  reason = "manual_archive",
): Promise<MemoryArchiveResponse | { error: string; status: number }> {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });

  if (!memory) {
    return { error: "Memory not found", status: 404 };
  }

  if (memory.archived) {
    return {
      error: "Memory is already archived",
      status: 409,
    };
  }

  const archivedAt = new Date();
  const observability = (memory.observability ?? {}) as Record<string, unknown>;

  await prisma.memory.update({
    where: { id: memoryId },
    data: {
      archived: true,
      archivedAt,
      retrievalEligible: false,
      ingestionStatus: "archived",
      observability: {
        ...observability,
        archived: true,
        retrievalEligible: false,
        archiveReason: reason,
        archivedAt: archivedAt.toISOString(),
      },
    },
  });

  await events.emit({
    event_type: MEMORY_LIFECYCLE_EVENT_TYPES.MEMORY_ARCHIVED,
    trace_id: memory.ingestionTraceId,
    workspace_id: memory.workspaceId,
    metadata: {
      operation: "memory_lifecycle",
      success: true,
      memory_id: memoryId,
      reason,
      lineage_id: memory.lineageId,
      version: memory.version,
    },
  });

  return {
    memoryId,
    workspaceId: memory.workspaceId,
    action: "archive",
    archived: true,
    archivedAt: archivedAt.toISOString(),
    retrievalEligible: false,
    message:
      "Memory archived — removed from retrieval but preserved for replay and observability.",
  };
}

export async function deleteMemory(
  prisma: PrismaClient,
  events: EventEmitter,
  memoryId: string,
  reason = "manual_delete",
): Promise<MemoryDeleteResponse | { error: string; status: number }> {
  const memory = await prisma.memory.findUnique({ where: { id: memoryId } });

  if (!memory) {
    return { error: "Memory not found", status: 404 };
  }

  const deletedAt = new Date();

  await events.emit({
    event_type: MEMORY_LIFECYCLE_EVENT_TYPES.MEMORY_DELETED,
    trace_id: memory.ingestionTraceId,
    workspace_id: memory.workspaceId,
    severity: "warn",
    metadata: {
      operation: "memory_lifecycle",
      success: true,
      memory_id: memoryId,
      reason,
      lineage_id: memory.lineageId,
      version: memory.version,
      title: memory.title,
      persistence_mode: memory.persistenceMode,
      deleted_at: deletedAt.toISOString(),
    },
  });

  await prisma.memory.delete({ where: { id: memoryId } });

  return {
    memoryId,
    workspaceId: memory.workspaceId,
    action: "delete",
    deleted: true,
    deletedAt: deletedAt.toISOString(),
    message: "Memory permanently deleted — chunks, embeddings, and relationships removed.",
  };
}
