import type { PrismaClient } from "@prisma/client";
import {
  buildLexicalSearchSql,
  type LexicalSearchCandidate,
  type LexicalSearchStore,
  type VectorSearchFilter,
} from "@memory-middleware/retrieval";

interface LexicalSearchRow {
  chunk_id: string;
  memory_id: string;
  sequence: number;
  content: string;
  token_count: number;
  lexical_score: number;
  title: string;
  memory_type: string;
}

export function createPgLexicalSearchStore(prisma: PrismaClient): LexicalSearchStore {
  return {
    async search(
      queryText: string,
      _queryTerms: string[],
      filter: VectorSearchFilter,
      limit: number,
    ): Promise<LexicalSearchCandidate[]> {
      void _queryTerms;
      const { sql, params } = buildLexicalSearchSql(queryText, filter, limit);
      const rows = await prisma.$queryRawUnsafe<LexicalSearchRow[]>(sql, ...params);

      return rows.map((row) => ({
        memoryId: row.memory_id,
        chunkId: row.chunk_id,
        sequence: row.sequence,
        content: row.content,
        tokenCount: row.token_count,
        lexicalScore: Number(row.lexical_score),
        memoryType: row.memory_type,
        title: row.title,
      }));
    },
  };
}
