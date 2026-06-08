# Sprint-37 Outcomes — Parallel BM25 Keyword Channel (V2)

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** AR-003
- **Priority:** P3
- **Effort:** 4+ weeks (spike subset delivered)

## Implementation summary

Delivered a **flag-gated V2 parallel lexical channel spike** that evaluates BM25/full-text retrieval alongside vector search without altering V1 ranking or context package output.

### Index design (Task 1)
- Documented in [`INDEX_DESIGN.md`](./INDEX_DESIGN.md)
- Prototype uses on-the-fly PostgreSQL `to_tsvector` + `ts_rank_cd` (`lexical-search-sql.ts`)
- Production recommendation: persisted `search_vector tsvector` + GIN index (not migrated in this spike)

### Flagged prototype (Task 2)
- Env flag: `RETRIEVAL_PARALLEL_BM25_V2_ENABLED` — **default off** (`retrieval-bm25-env.ts`)
- Pipeline input: `parallelBm25V2: { enabled, lexicalStore }` on `runRetrievalPipeline`
- When enabled: lexical search starts after preprocessing **in parallel** with query embed + pgvector
- Shadow output: `retrievalMetadata.lexicalChannelV2Shadow` + `lexical_channel_v2` stage (`shadow_only: true`)
- API wiring: `POST /retrieve` passes flag + `createPgLexicalSearchStore` when enabled

### Merge documented (Objective 2)
- [`MERGE_STRATEGY.md`](./MERGE_STRATEGY.md) — RRF k=60 merge preview (`buildRrfMergePreview`)
- Preview IDs stored in shadow metadata; **not applied** to V1 chunk ranking

### Benchmark (Task 3)
- Pipeline test confirms lexical channel starts concurrently with embed (`sprint-37-parallel-bm25-channel-v2.test.ts`)
- In-memory BM25 scoring benchmarked via unit tests (`bm25-score.test.ts`)

### Key files
| Area | Path |
|------|------|
| BM25 scoring | `packages/retrieval/src/bm25-score.ts` |
| Lexical store + SQL | `packages/retrieval/src/lexical-search-store.ts`, `lexical-search-sql.ts` |
| Parallel orchestration | `packages/retrieval/src/parallel-bm25-channel.ts` |
| Pipeline integration | `packages/retrieval/src/pipeline.ts` |
| Contracts | `packages/shared-types/src/lexical-channel-v2-contracts.ts` |
| API env + store | `apps/api/src/config/retrieval-bm25-env.ts`, `apps/api/src/lib/retrieval-lexical-store.ts` |

### Test evidence
```
npx tsx --test packages/retrieval/src/bm25-score.test.ts packages/retrieval/src/parallel-bm25-channel.test.ts packages/retrieval/src/lexical-search-sql.test.ts packages/retrieval/src/sprint-37-parallel-bm25-channel-v2.test.ts apps/api/src/config/retrieval-bm25-env.test.ts
13 tests, 13 passed, 0 failed (654ms)
```

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| GA-1: default off | `RETRIEVAL_PARALLEL_BM25_V2_ENABLED` defaults `false`; no env var → flag off |
| V1 path unchanged | Flag off: no lexical stage, no shadow metadata; flag on: shadow only, same chunk IDs from vector path |
| Retrieval tests required | 5 test files covering BM25, merge preview, SQL builder, pipeline flag on/off, env default |
| GA-1 (global ranking) | RRF merge is preview-only; reranking/threshold/stage order unchanged for V1 output |
| GA-2 | Deterministic BM25 + fixed RRF k=60; no ML tuning |
| GA-3 | Additive `lexicalChannelV2Shadow` + `lexical_channel_v2` stage; existing stages preserved |
| GA-4 | Measurements from test assertions only |
| GA-5 | Scope limited to retrieval lexical spike + API flag wiring |
| GA-6 | All existing `stages[]` records preserved; new stage additive |
| GA-7 | No new DB tables; on-the-fly tsvector SQL for spike |

## Verification summary

Verification ran the sprint-37 test framework (5 files, 13 tests) plus a full `packages/retrieval` regression sweep (34 tests).

### Test commands

```bash
# Sprint-37 targeted suite (required)
npx tsx --test \
  packages/retrieval/src/bm25-score.test.ts \
  packages/retrieval/src/parallel-bm25-channel.test.ts \
  packages/retrieval/src/lexical-search-sql.test.ts \
  packages/retrieval/src/sprint-37-parallel-bm25-channel-v2.test.ts \
  apps/api/src/config/retrieval-bm25-env.test.ts

# Full retrieval package regression (informational)
npx tsx --test packages/retrieval/src/*.test.ts
```

### Results

| Suite | Pass | Fail | Notes |
|-------|------|------|-------|
| Sprint-37 targeted (13 tests) | 13 | 0 | All objectives covered |
| Full retrieval package (34 tests) | 33 | 1 | `pipeline-timing.test.ts` expects legacy `vector_search` stage name; pipeline emits `vector_search:embedding` + `vector_search:pgvector` (pre-sprint-37 timing refactor, not introduced by V2 flag) |

### Prototype status

**Confirmed prototype (spike).** V2 lexical channel is flag-gated, shadow-only, and does not alter V1 chunk ranking. Production merge (RRF applied to live ranking) is documented but explicitly gated behind future approval in `MERGE_STRATEGY.md`.

### Regression check

- **Flag off:** No `lexical_channel_v2` stage, no `lexicalChannelV2Shadow` metadata; V1 chunk ID `chunk-vector` unchanged (`sprint-37-parallel-bm25-channel-v2.test.ts`).
- **Flag on:** Shadow metadata + additive stage; V1 chunk selection still `chunk-vector` (vector path only).
- **Compression:** No sprint-37 changes in compression packages; out of scope.

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Prototype behind flag | **met** | `RETRIEVAL_PARALLEL_BM25_V2_ENABLED` env + `parallelBm25V2` pipeline input; API wires `createPgLexicalSearchStore` only when flag true (`retrieval.ts:66-68`, `272-274`); shadow stage emitted when on |
| 2 | Merge documented | **met** | `MERGE_STRATEGY.md` documents RRF k=60; `buildRrfMergePreview()` implements preview-only merge; `mergePreview.strategy === "rrf_k60"` asserted in pipeline + unit tests |
| 3 | Default off | **met** | `loadRetrievalBm25Env()` returns `false` when env unset (`retrieval-bm25-env.test.ts`); `.env.example` documents commented default `false` |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| GA-1: default off | **no** | Env defaults `false`; flag off skips lexical branch entirely |
| GA-1 (global ranking) | **no** | RRF merge is preview-only; reranking/threshold/stage order for V1 output unchanged |
| V1 path unchanged | **no** | Pipeline tests: same `chunk-vector` selected flag on/off; no shadow metadata when off |
| Retrieval tests required | **no** | 5 automated test files, 13 passing assertions covering env, BM25, SQL, merge, pipeline |
| GA-2 | **no** | Deterministic tokenizer, Okapi BM25, fixed `RRF_K=60`; no ML tuning |
| GA-3 | **no** | Additive `lexicalChannelV2Shadow` + `lexical_channel_v2` stage; existing stages preserved |
| GA-4 | **no** | Measurements recorded from test assertions and command output only |
| GA-5 | **no** | Changes scoped to retrieval lexical spike + API flag wiring |
| GA-6 | **no** | No existing `stages[]` fields removed |
| GA-7 | **no** | No new DB tables; on-the-fly `to_tsvector` SQL for spike |

## Verification Score
- **Score:** 95 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

### Rubric breakdown
| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated evidence |
| Anti-objectives clean | 25% | 25 | No violations across sprint or global anti-objectives |
| Test coverage | 20% | 18 | Strong unit/pipeline coverage; no API route integration test or live PG lexical benchmark |
| Regression safety | 15% | 12 | V1 output unchanged in sprint tests; unrelated `pipeline-timing.test.ts` drift in full suite |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| architecture | post-assembly metadata expansion only | parallel lexical channel evaluated (shadow) | V2 lexical evaluated | `lexical_channel_v2` stage + `lexicalChannelV2Shadow` when flag on; overlap timing test confirms parallel start |
| V1 chunk selection | vector path | unchanged when flag on/off | V1 unchanged | `sprint-37-parallel-bm25-channel-v2.test.ts` (2 cases) |
| Flag default | n/a | `false` | default off | `retrieval-bm25-env.test.ts` |
| Sprint-37 test suite | n/a | 13 pass / 0 fail (609ms) | tests pass | verification run 2026-06-08 |
| Parallel overlap | sequential embed then vector | lexical starts alongside embed (≥0ms overlap window) | architecture evaluated | overlap probe test with 30ms delays |

## Places for improvement

1. **API route integration test** — verify `POST /retrieve` passes `parallelBm25V2` when env flag is set (currently only env loader + pipeline are tested).
2. **Live PostgreSQL lexical benchmark** — spike SQL builder is unit-tested; no integration test against real `memory_chunks` with `createPgLexicalSearchStore`.
3. **`pipeline-timing.test.ts` drift** — full retrieval suite has 1 failing test expecting `vector_search` stage; pipeline now uses `vector_search:embedding` + `vector_search:pgvector`. Fix belongs to execution-timing sprint, not sprint-37, but blocks a clean full-package green run.
4. **Production index path** — persisted GIN `search_vector` column documented in `INDEX_DESIGN.md` Option B but not migrated; required before enabling merge in production.
