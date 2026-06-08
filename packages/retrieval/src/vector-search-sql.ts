import { appendDomainScopeConditions } from "./domain-scope-sql.js";
import type { VectorSearchFilter } from "./vector-retrieval.js";

export interface VectorSearchSqlQuery {
  sql: string;
  params: unknown[];
}

/**
 * Builds the parameterized pgvector similarity search SQL used by retrieval.
 * Exported for EXPLAIN ANALYZE benchmarking (sprint-17) and the API vector store.
 */
export function buildVectorSearchSql(
  queryEmbedding: number[],
  filter: VectorSearchFilter,
  limit: number,
  similarityThreshold?: number,
): VectorSearchSqlQuery {
  const vectorLiteral = `[${queryEmbedding.join(",")}]`;
  const conditions: string[] = [
    `m.workspace_id = $2::text`,
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

  if (filter.domainScope) {
    paramIndex = appendDomainScopeConditions(
      filter.domainScope,
      conditions,
      params,
      paramIndex,
    );
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

  return { sql, params };
}
