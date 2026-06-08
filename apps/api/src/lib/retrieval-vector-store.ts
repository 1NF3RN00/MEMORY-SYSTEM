import type { PrismaClient } from "@prisma/client";
import {
  buildVectorSearchSql,
  type VectorSearchCandidate,
  type VectorSearchFilter,
  type VectorSearchStore,
} from "@memory-middleware/retrieval";
import type { CanonicalMemoryScoring } from "@memory-middleware/shared-types";

interface ChunkSearchRow {
  chunk_id: string;
  memory_id: string;
  sequence: number;
  content: string;
  token_count: number;
  similarity: number;
  title: string;
  memory_type: string;
  version: number;
  summary: string | null;
  scoring: CanonicalMemoryScoring;
  updated_at: Date;
  ingestion_trace_id: string;
  normalization_trace_id: string;
}

export function createPgVectorSearchStore(prisma: PrismaClient): VectorSearchStore {
  return {
    async search(
      queryEmbedding: number[],
      filter: VectorSearchFilter,
      limit: number,
      similarityThreshold?: number,
    ): Promise<VectorSearchCandidate[]> {
      const { sql, params } = buildVectorSearchSql(
        queryEmbedding,
        filter,
        limit,
        similarityThreshold,
      );

      const rows = await prisma.$queryRawUnsafe<ChunkSearchRow[]>(sql, ...params);

      return rows.map((row) => {
        const scoring = row.scoring as CanonicalMemoryScoring;
        return {
          memoryId: row.memory_id,
          chunkId: row.chunk_id,
          sequence: row.sequence,
          content: row.content,
          tokenCount: row.token_count,
          semanticSimilarity: Number(row.similarity),
          importanceScore: scoring.importanceScore ?? 1,
          reinforcementScore: scoring.reinforcementScore ?? 0,
          semanticDensityScore: scoring.semanticDensityScore ?? 0,
          memoryUpdatedAt: row.updated_at.toISOString(),
          memoryType: row.memory_type,
          title: row.title,
          version: row.version,
          summary: row.summary,
          ingestionTraceId: row.ingestion_trace_id,
          normalizationTraceId: row.normalization_trace_id,
        };
      });
    },
  };
}
