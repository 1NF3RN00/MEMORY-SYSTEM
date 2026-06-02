/**
 * Memory lifecycle API contracts — archive (recommended) and full delete.
 */

export type MemoryLifecycleAction = "archive" | "delete";

export interface MemoryArchiveRequest {
  reason?: string;
}

export interface MemoryArchiveResponse {
  memoryId: string;
  workspaceId: string;
  action: "archive";
  archived: true;
  archivedAt: string;
  retrievalEligible: false;
  message: string;
}

export interface MemoryDeleteRequest {
  /** Required safety flag — full delete is irreversible. */
  confirm: true;
  reason?: string;
}

export interface MemoryDeleteResponse {
  memoryId: string;
  workspaceId: string;
  action: "delete";
  deleted: true;
  deletedAt: string;
  message: string;
}

export const MEMORY_LIFECYCLE_EVENT_TYPES = {
  MEMORY_ARCHIVED: "memory.archived",
  MEMORY_DELETED: "memory.deleted",
} as const;

export type MemoryLifecycleEventType =
  (typeof MEMORY_LIFECYCLE_EVENT_TYPES)[keyof typeof MEMORY_LIFECYCLE_EVENT_TYPES];
