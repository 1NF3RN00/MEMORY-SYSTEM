/**
 * Memory chunks belong to a MemoryObject — they are not independent memory entities.
 */
export interface MemoryChunkMetadata {
  token_estimate?: number;
  heading?: string;
  [key: string]: unknown;
}

export interface MemoryChunk {
  id: string;
  memory_id: string;
  sequence: number;
  content: string;
  metadata: MemoryChunkMetadata;
  created_at: string;
}
