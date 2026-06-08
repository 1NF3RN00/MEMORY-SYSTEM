# Sprint-37 — V2 Channel Merge Strategy (DOCUMENTATION ONLY)

> **Status:** Documented for evaluation. **Not applied to V1 ranking** in this sprint.

## Channels

| Channel | Source | Rank signal |
|---------|--------|-------------|
| Vector (V1) | pgvector cosine similarity + calibrated threshold | Semantic similarity + reranking boosts |
| Lexical (V2 spike) | PostgreSQL `ts_rank_cd` or in-memory Okapi BM25 | Lexical term overlap |

## Proposed merge — Reciprocal Rank Fusion (RRF)

RRF combines ranked lists without normalizing incompatible score scales:

```
RRF(d) = Σ 1 / (k + rank_i(d))
```

Where:

- `k = 60` (constant `RRF_K` in `parallel-bm25-channel.ts`)
- `rank_i(d)` is the 1-based rank of document `d` in channel `i`
- Sum over channels where `d` appears

### Example

| chunkId | Vector rank | Lexical rank | RRF score |
|---------|-------------|--------------|-----------|
| A | 1 | — | 1/(60+1) = 0.0164 |
| B | 2 | 1 | 1/(60+2) + 1/(60+1) = 0.0323 |
| C | — | 2 | 1/(60+2) = 0.0161 |

Final order: B, A, C.

## Shadow implementation (sprint-37)

When `RETRIEVAL_PARALLEL_BM25_V2_ENABLED=true`:

1. Vector channel produces V1 candidates (unchanged)
2. Lexical channel runs in parallel, produces shadow candidates
3. `buildRrfMergePreview()` computes overlap + `previewTopChunkIds`
4. Preview is stored on `contextPackage.retrievalMetadata.lexicalChannelV2Shadow`
5. **V1 context package chunk selection uses vector path only**

## Approval gate for production merge

Before applying RRF to live ranking:

- [ ] Persisted GIN index (see `INDEX_DESIGN.md` Option B)
- [ ] Retrieval regression suite with fixed query/chunk fixtures
- [ ] Explicit sprint authorization for GA-1 algorithm change
- [ ] Dashboard trace migration plan for new ranking breakdown fields

## Anti-objective compliance

| Anti-objective | How merge doc complies |
|----------------|------------------------|
| GA-1 | Merge is preview-only; V1 ranking unchanged |
| V1 path unchanged | Flag off → no lexical stage, no shadow |
| Determinism | Fixed `k=60`, stable sort tie-break by `chunkId` |
