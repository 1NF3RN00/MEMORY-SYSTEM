# Wave 6 outcomes — Retrieval depth
- **Focus:** pgvector tuning, embedding cache, context-package race, timing completion, ingestion timing.
- **Generated:** 2026-06-08T21:47:31.064Z
- **Sprints:** 7/7 verified complete
- **Average score:** 97/100
| Sprint | Folder | Impl | Verify | Score | Objectives |
|--------|--------|------|--------|-------|------------|
| 17 | sprint-17-pgvector-index-review | complete | complete | 94 | 3 / 3 |
| 18 | sprint-18-embedding-query-cache | complete | complete | 98 | 3 / 3 |
| 29 | sprint-29-context-package-race-fix | complete | complete | 98 | 3 / 3 |
| 36 | sprint-36-execution-timing-completion | complete | complete | 98 | 3 / 3 |
| 39 | sprint-39-context-delivery-timing-wrappers | complete | complete | 100 | 3 / 3 |
| 23 | sprint-23-ingestion-timing-wrappers | complete | complete | 97 | 3/3 |
| 24 | sprint-24-dashboard-timing-audit-display | complete | complete | 97 | 3 / 3 |

## Per-sprint notes

### sprint-17-pgvector-index-review

Shipped a repeatable **EXPLAIN ANALYZE** harness for the production pgvector retrieval SQL and captured real Postgres plans against the configured Supabase database.

### 1. Shared SQL builder (`packages/retrieval/src/vector-search-sql.ts`)
- Extracted `buildVectorSearchSql()` from `apps/api/src/lib/retrieval-vector-store.ts` so EXPLAIN runs against the **exact** SQL issued during `vector_search:pgvector` (LAT-001).
- Exported via `@memory-middleware/retrieval` index for API reuse.

### 2. Benchmark script (`scripts/benchmark-pgvector-explain.ts`)
- Connects via `DATABASE_URL` / `DIRECT_URL`, resolves a benchmark workspace, samples a 1536-d embedding (existing chunk or unit-vector fallback).
- Runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for three representative variants:
  -

---

### sprint-18-embedding-query-cache

Added a process-wide LRU/TTL query embedding cache in `packages/retrieval/src/query-embedding-cache.ts` and integrated it into `runRetrievalPipeline` (`packages/retrieval/src/pipeline.ts`).

**Cache key:** `workspaceId` + `EMBEDDING_MODEL_V1` + normalized query + embedding input text (the exact string sent to the embed API). The embedding input is the deterministic enriched form produced by `preprocessQuery` (`embeddingText ?? normalizedQuery`).

**Behavior:**
- On cache **miss**: calls `embeddingClient.embed`, records `vector_search:embedding` timing, stores result in cache.
- On cache **hit**: skips `embeddingClient.embed` and `vector_search:embedding` timing stage; sets `embedding_cache_hit: true` on the `vector_retrieval` stage metadata.
- Default limits: 500 entries, 1-hour TTL (confi

---

### sprint-29-context-package-race-fix

### Root cause (PBUG-001)
`POST /retrieve` persisted in-flight stage progress via `onStage`, which read-modify-wrote `retrievalOperation.result` without guarding terminal state. A late stage write could overwrite a completed row's `result` after `completeRetrievalOperation` had stored `contextPackage`, leaving `status: "completed"` with no package — breaking compression and replay.

### Fix
1. **Two-phase completion** in `completeRetrievalOperation` (`apps/api/src/lib/retrieval-store.ts`):
   - Phase 1: write full `result` (including `contextPackage`) while `status` remains `processing`.
   - Phase 2: set `status` + `completedAt` only after the package is stored.
   - Reject `status: "completed"` when `contextPackage` is absent (prevents false success).

2. *

---

### sprint-36-execution-timing-completion

Completed optional execution-timing coverage for context-delivery, relationship graph routes, and remaining major pipeline routes.

### Changes shipped

| Area | File(s) | What was added |
|------|---------|----------------|
| Context delivery pipeline | `packages/context-delivery/src/pipeline.ts` | Optional `timingCollector`; entire render wrapped in `measurePipelineStage(..., "context_rendering", ...)` |
| Context render route | `apps/api/src/routes/context.ts` | `POST /context/render` wrapped in `runWithTimingAsync`; passes `timingCollector`; returns `timingAudit` |
| Compression route | `apps/api/src/routes/compression.ts` | Upgraded `POST /compress` from `runWithLlmCallAsync` to `runWithTimingAsync` (LLM ALS preserved); passes `timingCollector` to pipeline; returns `timingAudit` |

---

### sprint-39-context-delivery-timing-wrappers

Extended context-delivery pipeline instrumentation beyond sprint-36's outer `context_rendering` wrapper by timing the domain fact-precedence step inside the render pipeline.

| Area | File | Change |
|------|------|--------|
| Sub-stage timing | `packages/context-delivery/src/pipeline.ts` | `fact_precedence` block wrapped with `measurePipelineStage(..., "fact_resolution", ...)` around `prepareContextPackageForDelivery()` |
| Route wiring | `apps/api/src/routes/context.ts` | Already passes `timingCollector` and returns `timingAudit` (sprint-36) — verified unchanged |
| Tests | `packages/context-delivery/src/pipeline-timing.test.ts` | 4 tests: `context_rendering`, `fact_resolution`, legacy `fact_precedence` stages, byte-identical output |

### Objectives evidence

1.

---

### sprint-23-ingestion-timing-wrappers

Wrapped `runIngestionPipeline` with the shared `ExecutionTimingCollector` pattern used by retrieval and context-delivery:

1. **`PipelineOptions.timingCollector`** — optional collector passed from callers; resolved via `resolvePipelineCollector(input.traceId, options.timingCollector)`.
2. **Stage wrappers** — `measurePipelineStage` at four audit boundaries:
   - `ingestion` — entire pipeline
   - `normalization` — website crawl (when applicable), `normalizeContent()`, and `persistSourceTruth()`
   - `chunking` — fixed-chunk path or structural chunking block
   - `embedding_generation` — `embedChunks()`
3. *

---

### sprint-24-dashboard-timing-audit-display

Shipped hrtime-based pipeline timing in the existing `RetrievalTimeline` on `RetrievalTracesPage` — no new routes or fetches.

| Area | File | Change |
|------|------|--------|
| Timeline utilities | `apps/dashboard/src/lib/timelineTiming.ts` | `formatDurationMs`, `formatTimingStageLabel`, `resolveTimelineStages`, `timingAuditToStageRecords` |
| Timeline UI | `apps/dashboard/src/components/observability/RetrievalTimeline.tsx` | Optional `timingAudit` prop; prefers hrtime stages; shows `hrtime` badge and sub-ms durations; legacy fallback |
| Trace page | `apps/dashboard/src/pages/RetrievalTracesPage.tsx` | `TraceDetail.trace.timingAudit` type; passes audit to timeline |

---
