import type { Memory, MemoryChunk } from "@prisma/client";
import type {
  CanonicalMemoryChunk,
  CanonicalMemoryObject,
} from "@memory-middleware/shared-types";

export function mapChunkRow(row: MemoryChunk): CanonicalMemoryChunk {
  const metadata = (row.metadata ?? {}) as unknown as CanonicalMemoryChunk["metadata"];
  const observability = (row.observability ?? {}) as unknown as CanonicalMemoryChunk["observability"];

  return {
    id: row.id,
    memoryId: row.memoryId,
    chunkIndex: row.sequence,
    content: row.content,
    tokenCount: row.tokenCount,
    embeddingStatus: row.embeddingStatus as CanonicalMemoryChunk["embeddingStatus"],
    metadata,
    observability,
    createdAt: row.createdAt.toISOString(),
  };
}

export function mapMemoryRow(
  row: Memory,
  chunks: MemoryChunk[],
): CanonicalMemoryObject {
  const metadata = row.metadata as unknown as CanonicalMemoryObject["metadata"];
  const scoring = row.scoring as unknown as CanonicalMemoryObject["scoring"];
  const lineage = row.lineage as unknown as CanonicalMemoryObject["lineage"];
  const observability = row.observability as unknown as CanonicalMemoryObject["observability"];

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    version: row.version,
    ...(row.parentMemoryId ? { parentMemoryId: row.parentMemoryId } : {}),
    memoryType: row.memoryType as CanonicalMemoryObject["memoryType"],
    persistenceMode: row.persistenceMode as CanonicalMemoryObject["persistenceMode"],
    sourceType: row.sourceType as CanonicalMemoryObject["sourceType"],
    title: row.title,
    normalizedContent: row.normalizedContent,
    ...(row.summary ? { summary: row.summary } : {}),
    chunks: chunks.map(mapChunkRow).sort((a, b) => a.chunkIndex - b.chunkIndex),
    metadata,
    scoring,
    lineage,
    observability: {
      ...observability,
      retrievalEligible: row.retrievalEligible,
      archived: row.archived,
    },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.archivedAt ? { archivedAt: row.archivedAt.toISOString() } : {}),
  };
}
