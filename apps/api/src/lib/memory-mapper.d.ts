import type { Memory, MemoryChunk } from "@prisma/client";
import type { CanonicalMemoryChunk, CanonicalMemoryObject } from "@memory-middleware/shared-types";
export declare function mapChunkRow(row: MemoryChunk): CanonicalMemoryChunk;
export declare function mapMemoryRow(row: Memory, chunks: MemoryChunk[]): CanonicalMemoryObject;
//# sourceMappingURL=memory-mapper.d.ts.map