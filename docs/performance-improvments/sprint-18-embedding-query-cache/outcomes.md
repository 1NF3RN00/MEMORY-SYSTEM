# Sprint-18 Outcomes — Embedding Query Cache

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-17, LAT-002
- **Priority:** P2
- **Effort:** 1 week

## Implementation summary

Added a process-wide LRU/TTL query embedding cache in `packages/retrieval/src/query-embedding-cache.ts` and integrated it into `runRetrievalPipeline` (`packages/retrieval/src/pipeline.ts`).

**Cache key:** `workspaceId` + `EMBEDDING_MODEL_V1` + normalized query + embedding input text (the exact string sent to the embed API). The embedding input is the deterministic enriched form produced by `preprocessQuery` (`embeddingText ?? normalizedQuery`).

**Behavior:**
- On cache **miss**: calls `embeddingClient.embed`, records `vector_search:embedding` timing, stores result in cache.
- On cache **hit**: skips `embeddingClient.embed` and `vector_search:embedding` timing stage; sets `embedding_cache_hit: true` on the `vector_retrieval` stage metadata.
- Default limits: 500 entries, 1-hour TTL (configurable via `QueryEmbeddingCacheOptions`).

**Invalidation policy** (documented in module header):
1. TTL expiry on read
2. LRU eviction at capacity
3. Automatic miss when `EMBEDDING_MODEL_V1` changes (included in key)
4. Workspace isolation via `workspaceId` in key
5. Enrichment isolation via full embedding input in key (retrieval-plan expansion cannot collide)
6. Corpus/memory updates do not invalidate query embeddings (query vectors are independent of stored chunks)

**Tests added:**
- `packages/retrieval/src/query-embedding-cache.test.ts` — key construction, hit/miss, workspace isolation, LRU, TTL
- `packages/retrieval/src/pipeline-embedding-cache.test.ts` — pipeline skips embed on repeat query; workspace isolation

**Evidence (test run):**
```
npx tsx --test packages/retrieval/src/query-embedding-cache.test.ts packages/retrieval/src/pipeline-embedding-cache.test.ts
7 tests passed (cache hit skips client; embedding_cache_hit metadata recorded)
```

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Workspace isolation | Cache key includes `workspaceId`; pipeline test confirms separate workspaces do not share entries |
| No wrong embedding on collision | Key includes full `embeddingInput` text and `EMBEDDING_MODEL_V1`, not just raw query string; enrichment/plan differences produce distinct keys |
| Deterministic retrieval preserved | Cache returns the same stored vector for identical key; ranking/threshold/stage ordering unchanged; only embed API call is elided on hit |
| GA-1 | No changes to ranking, thresholds, or stage ordering |
| GA-2 | No ML/heuristics; deterministic LRU/TTL Map cache only |
| GA-3 | Added `embedding_cache_hit` metadata field on existing `vector_retrieval` stage; no trace fields removed |
| GA-4 | No performance numbers fabricated; evidence is test output only |
| GA-5 | Scope limited to retrieval query-embed path; no unrelated refactors |
| GA-6 | All existing `stages[]` records preserved; one additive metadata field |
| GA-7 | In-memory Map cache; no new database tables |

## Verification summary

Verification agent ran the sprint test suite and extended `pipeline-embedding-cache.test.ts` with two additional checks: explicit cache-miss embed call and cache-hit timing/latency measurement.

**Test command (2026-06-08):**
```
npx tsx --test packages/retrieval/src/query-embedding-cache.test.ts packages/retrieval/src/pipeline-embedding-cache.test.ts
9 tests, 9 passed, 0 failed (648ms)
```

**Testing framework checklist:**
| Check | Result | Evidence |
|-------|--------|----------|
| Second identical retrieve faster | pass | `omits vector_search:embedding timing on cache hit and second retrieve is faster` — hit wall-clock < miss − 10ms with 20ms mock embed delay |
| Miss still calls OpenAI/embed client | pass | `calls embed client on cache miss` — `embedCalls === 1`; `skips embed client on identical query cache hit` — `embedCalls === 1` after two identical runs |
| Isolation test | pass | Unit + pipeline tests: `isolates workspaces with identical normalized queries`, `does not share cache entries across workspaces` — `embedCalls === 2` |

**Code review (regression):**
- `pipeline.ts` only wraps the embed path in cache lookup; `vectorStore.search`, threshold, reranking, and stage order unchanged.
- Cache hit bypasses `measurePipelineStage(..., "vector_search:embedding", ...)` entirely — embed latency ~0ms on hit.
- Invalidation policy documented in `query-embedding-cache.ts` module header (lines 4–16).

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Identical query skips OpenAI on hit | **met** | `resolveQueryEmbedding` test: `calls === 1` after two identical resolves; pipeline test: `embedCalls === 1` after two `runRetrievalPipeline` calls with same input |
| 2 | Invalidation documented | **met** | Module header in `query-embedding-cache.ts` documents TTL, LRU, model-version keying, workspace/enrichment isolation, and corpus non-invalidation; LRU/TTL covered by unit tests |
| 3 | Reduced embed stage on hit | **met** | `embedding_cache_hit: true` on second `vector_retrieval` stage; `vector_search:embedding` timing stage absent on hit (`hitEmbedStage === undefined`); miss stage `durationMs >= 20` with mock delay |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Workspace isolation | **no** | Key includes `workspaceId`; pipeline + unit tests require separate embed calls per workspace |
| No wrong embedding on collision | **no** | Key includes full `embeddingInput` + `EMBEDDING_MODEL_V1`; unit test asserts distinct keys for different workspaces and enrichment text |
| Deterministic retrieval preserved | **no** | Same cached vector returned on hit; ranking/threshold/pgvector/reranking paths unchanged in `pipeline.ts` |
| GA-1 (ranking/threshold/order) | **no** | No edits to `applySimilarityThreshold`, reranking, or stage sequence |
| GA-2 (non-deterministic tuning) | **no** | LRU/TTL Map only |
| GA-3 (trace compatibility) | **no** | Additive `embedding_cache_hit` metadata only |
| GA-4 (fabricated numbers) | **no** | Measurements from test run assertions and `performance.now()` deltas |
| GA-5 (scope creep) | **no** | Changes confined to `packages/retrieval` query-embed path |
| GA-6 (stages[] removal) | **no** | All stage records preserved |
| GA-7 (new DB tables) | **no** | In-memory Map cache |

## Verification Score
- **Score:** 98 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown:**
| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated evidence |
| Anti-objectives clean | 25% | 25 | Sprint + global anti-objectives verified |
| Test coverage | 20% | 18 | 9 unit/pipeline tests; no HTTP/E2E or live OpenAI path |
| Regression safety | 15% | 15 | Retrieval pipeline logic unchanged aside from embed elision |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| `vector_search:embedding` stage (cache miss) | recorded, ≥20ms (mock API delay) | unchanged on miss | — | `missEmbedStage.durationMs >= 20` in timing test |
| `vector_search:embedding` stage (cache hit) | recorded on every retrieve | **omitted** | embed ~0ms on hit | `hitEmbedStage === undefined`; no `measurePipelineStage` call on hit path |
| Embed client invocations (identical query ×2) | 2 calls | **1 call** | skip OpenAI on hit | `embedCalls === 1` in pipeline + unit tests |
| Wall-clock (identical query ×2, 20ms mock embed) | miss run includes embed delay | hit run **>10ms faster** than miss | second retrieve faster | `hitElapsedMs < missElapsedMs - embedDelayMs/2` |

## Places for improvement
- Add a pipeline-level test where `retrievalPlan` / enrichment produces different `embeddingInput` for the same raw query (collision prevention is key-tested only today).
- Optional manual invalidation hook for operators who rotate embedding config without process restart (model change already auto-misses via key).
- HTTP-level integration test exercising the default process-wide cache across two `/retrieval` requests (current coverage is package-level only).
