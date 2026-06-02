import type { PrismaClient } from "@prisma/client";
import type {
  VectorSearchCandidate,
  VectorSearchFilter,
  VectorSearchStore,
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
      const vectorLiteral = `[${queryEmbedding.join(",")}]`;
      const conditions: string[] = [
        `m.workspace_id = $2::uuid`,
        `m.retrieval_eligible = true`,
        `m.archived = false`,
        `mc.embedding_status = 'completed'`,
        `mc.embedding IS NOT NULL`,
        `(m.expires_at IS NULL OR m.expires_at > NOW())`,
      ];
      const params: unknown[] = [vectorLiteral, filter.workspaceId];
      let paramIndex = 3;

      if (filter.memoryTypes?.length) {
        conditions.push(`m.memory_type = ANY($${paramIndex}::text[])`);
        params.push(filter.memoryTypes);
        paramIndex += 1;
      }

      if (filter.timeframe?.start) {
        conditions.push(`m.created_at >= $${paramIndex}::timestamptz`);
        params.push(filter.timeframe.start);
        paramIndex += 1;
      }

      if (filter.timeframe?.end) {
        conditions.push(`m.created_at <= $${paramIndex}::timestamptz`);
        params.push(filter.timeframe.end);
        paramIndex += 1;
      }

      const similarityExpr = `(1 - (mc.embedding <=> $1::vector))`;

      if (similarityThreshold !== undefined) {
        conditions.push(`${similarityExpr} >= $${paramIndex}`);
        params.push(similarityThreshold);
        paramIndex += 1;
      }

      params.push(limit);

      const sql = `
        SELECT
          mc.id AS chunk_id,
          mc.memory_id,
          mc.sequence,
          mc.content,
          mc.token_count,
          ${similarityExpr} AS similarity,
          m.title,
          m.memory_type,
          m.version,
          m.summary,
          m.scoring,
          m.updated_at,
          m.ingestion_trace_id,
          m.normalization_trace_id
        FROM memory_chunks mc
        INNER JOIN memories m ON m.id = mc.memory_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY mc.embedding <=> $1::vector ASC
        LIMIT $${paramIndex}
      `;

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
