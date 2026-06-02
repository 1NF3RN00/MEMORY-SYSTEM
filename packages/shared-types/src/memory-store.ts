import type { MemoryObject } from "./memory-object.js";
import type { MemoryChunk } from "./memory-chunk.js";

/**
 * Memory store read/write contracts — append-only semantics enforced at implementation layer.
 */
export interface MemoryStoreReader {
  getMemoryById(workspaceId: string, memoryId: string): Promise<MemoryObject | null>;
  listMemoryVersions(workspaceId: string, lineageId: string): Promise<MemoryObject[]>;
  getChunksForMemory(memoryId: string): Promise<MemoryChunk[]>;
}

export interface MemoryStoreWriter {
  appendMemoryVersion(memory: Omit<MemoryObject, "id">): Promise<MemoryObject>;
  appendChunks(chunks: Omit<MemoryChunk, "id" | "created_at">[]): Promise<MemoryChunk[]>;
}
