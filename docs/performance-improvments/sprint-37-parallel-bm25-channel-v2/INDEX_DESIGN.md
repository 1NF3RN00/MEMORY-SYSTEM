# Sprint-37 — V2 Lexical Index Design (SPIKE)

## Problem (AR-003)

V1 keyword search runs **after context assembly** as metadata expansion (`applyRetrievalExpansion`). It does not participate in candidate retrieval or ranking. True hybrid retrieval requires a **parallel lexical channel** that runs alongside vector search.

## Design goals

| Goal | Approach |
|------|----------|
| Parallel execution | Start lexical search after preprocessing, concurrently with query embed + pgvector |
| Determinism | Fixed tokenizer, Okapi BM25 (in-memory) or `ts_rank_cd` (SQL spike) |
| Observability | Shadow metadata on `retrievalMetadata.lexicalChannelV2Shadow` + `lexical_channel_v2` stage |
| V1 safety | Flag-gated (`RETRIEVAL_PARALLEL_BM25_V2_ENABLED`, default off); shadow only |

## Index options evaluated

### Option A — On-the-fly PostgreSQL full-text (prototype shipped)

```sql
to_tsvector('english', mc.content) @@ plainto_tsquery('english', $query)
ORDER BY ts_rank_cd(to_tsvector('english', mc.content), plainto_tsquery('english', $query)) DESC
```

- **Pros:** No migration; reuses existing `memory_chunks.content`; same scope filters as vector SQL
- **Cons:** Recomputes tsvector per row; not suitable for production scale without persisted index

### Option B — Persisted tsvector + GIN (recommended production path)

```sql
ALTER TABLE memory_chunks
  ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce(content, ''))) STORED;

CREATE INDEX memory_chunks_search_vector_gin
  ON memory_chunks USING GIN (search_vector);
```

Query becomes:

```sql
WHERE search_vector @@ plainto_tsquery('english', $query)
ORDER BY ts_rank_cd(search_vector, plainto_tsquery('english', $query)) DESC
```

- **Pros:** Index-backed lexical retrieval; predictable latency at scale
- **Cons:** Requires migration + backfill validation; English config only in V2 spike

### Option C — Dedicated BM25 engine (e.g. Tantivy, Elasticsearch)

- **Pros:** Native BM25, advanced tokenization
- **Cons:** New infrastructure; violates GA-7 simplicity unless approved

## Spike decision

Ship **Option A** behind flag for evaluation. Document **Option B** as the production index design. Do not merge lexical scores into V1 ranking until a follow-up sprint approves algorithm changes (GA-1).

## Ingestion alignment

When Option B is approved:

1. Add `search_vector` generated column (no application write path)
2. Reindex is automatic on content update via `GENERATED ALWAYS`
3. Optional: extend chunk metadata observability with `lexicalIndexVersion`

## Files

| File | Role |
|------|------|
| `packages/retrieval/src/lexical-search-sql.ts` | Option A SQL builder |
| `packages/retrieval/src/bm25-score.ts` | Deterministic in-memory BM25 for tests/benchmarks |
| `apps/api/src/lib/retrieval-lexical-store.ts` | Prisma lexical store |
