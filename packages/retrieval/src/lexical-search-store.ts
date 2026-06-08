import type { VectorSearchFilter } from "./vector-retrieval.js";

export interface LexicalSearchCandidate {
  memoryId: string;
  chunkId: string;
  sequence: number;
  content: string;
  tokenCount: number;
  /** Lexical rank score (BM25 or ts_rank_cd proxy from SQL). */
  lexicalScore: number;
  memoryType: string;
  title: string;
}

export interface LexicalSearchStore {
  search(
    queryText: string,
    queryTerms: string[],
    filter: VectorSearchFilter,
    limit: number,
  ): Promise<LexicalSearchCandidate[]>;
}

/** In-memory lexical store for unit tests and offline benchmarks. */
export function createInMemoryLexicalSearchStore(
  corpus: Array<{
    memoryId: string;
    chunkId: string;
    sequence: number;
    content: string;
    tokenCount: number;
    memoryType: string;
    title: string;
    workspaceId: string;
  }>,
): LexicalSearchStore {
  return {
    async search(queryText, queryTerms, filter, limit) {
      void queryText;
      const { scoreBm25Documents, tokenizeForBm25 } = await import("./bm25-score.js");

      const eligible = corpus.filter((row) => {
        if (row.workspaceId !== filter.workspaceId) return false;
        if (filter.memoryTypes?.length && !filter.memoryTypes.includes(row.memoryType)) {
          return false;
        }
        return true;
      });

      const terms =
        queryTerms.length > 0 ? queryTerms : tokenizeForBm25(queryText);

      const scored = scoreBm25Documents(
        terms,
        eligible.map((row) => ({ id: row.chunkId, text: row.content })),
      );

      const byId = new Map(eligible.map((row) => [row.chunkId, row]));

      return scored
        .filter((entry) => entry.score > 0)
        .slice(0, limit)
        .map((entry) => {
          const row = byId.get(entry.id)!;
          return {
            memoryId: row.memoryId,
            chunkId: row.chunkId,
            sequence: row.sequence,
            content: row.content,
            tokenCount: row.tokenCount,
            lexicalScore: entry.score,
            memoryType: row.memoryType,
            title: row.title,
          };
        });
    },
  };
}
