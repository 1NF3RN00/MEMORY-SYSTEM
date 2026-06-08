import { appendDomainScopeConditions } from "./domain-scope-sql.js";
import type { VectorSearchFilter } from "./vector-retrieval.js";

export interface LexicalSearchSqlQuery {
  sql: string;
  params: unknown[];
}

/**
 * Builds parameterized PostgreSQL full-text lexical search SQL for the V2 spike.
 * Uses on-the-fly tsvector + ts_rank_cd (BM25-like ranking in PG).
 * Production would replace this with a persisted tsvector column + GIN index
 * (see sprint-37 INDEX_DESIGN.md).
 */
export function buildLexicalSearchSql(
  queryText: string,
  filter: VectorSearchFilter,
  limit: number,
): LexicalSearchSqlQuery {
  const conditions: string[] = [
    `m.workspace_id = $1::text`,
    `m.retrieval_eligible = true`,
    `m.archived = false`,
    `(m.expires_at IS NULL OR m.expires_at > NOW())`,
    `to_tsvector('english', mc.content) @@ plainto_tsquery('english', $2::text)`,
  ];
  const params: unknown[] = [filter.workspaceId, queryText];
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

  params.push(limit);

  const rankExpr = `ts_rank_cd(to_tsvector('english', mc.content), plainto_tsquery('english', $2::text))`;

  const sql = `
        SELECT
          mc.id AS chunk_id,
          mc.memory_id,
          mc.sequence,
          mc.content,
          mc.token_count,
          ${rankExpr} AS lexical_score,
          m.title,
          m.memory_type
        FROM memory_chunks mc
        INNER JOIN memories m ON m.id = mc.memory_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY ${rankExpr} DESC, mc.id ASC
        LIMIT $${paramIndex}
      `;

  return { sql, params };
}
