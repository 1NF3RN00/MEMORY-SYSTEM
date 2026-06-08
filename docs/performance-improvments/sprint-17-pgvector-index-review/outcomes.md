# Sprint-17 Outcomes — pgvector Index EXPLAIN Review

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-16, LAT-001, MF-001
- **Priority:** P2
- **Effort:** 1 week

## Implementation summary

Shipped a repeatable **EXPLAIN ANALYZE** harness for the production pgvector retrieval SQL and captured real Postgres plans against the configured Supabase database.

### 1. Shared SQL builder (`packages/retrieval/src/vector-search-sql.ts`)
- Extracted `buildVectorSearchSql()` from `apps/api/src/lib/retrieval-vector-store.ts` so EXPLAIN runs against the **exact** SQL issued during `vector_search:pgvector` (LAT-001).
- Exported via `@memory-middleware/retrieval` index for API reuse.

### 2. Benchmark script (`scripts/benchmark-pgvector-explain.ts`)
- Connects via `DATABASE_URL` / `DIRECT_URL`, resolves a benchmark workspace, samples a 1536-d embedding (existing chunk or unit-vector fallback).
- Runs `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` for three representative variants:
  - `base_precision` — topK=24, workspace-only filter
  - `expanded_topk` — topK=48
  - `semantic_memory_filter` — topK=24 + `memory_type = semantic`
- Documents pgvector-related indexes from `pg_indexes`.
- Emits evidence-based recommendations (no index/candidate-limit changes).
- npm script: `npm run perf:bench-pgvector-explain`

### 3. Tests
| File | Coverage |
|------|----------|
| `scripts/benchmark-pgvector-explain.test.ts` | Postgres EXPLAIN JSON parsing, plan analysis, recommendation builder |
| `packages/retrieval/src/vector-search-sql.test.ts` | SQL shape parity with production retrieval store |

### 4. Live EXPLAIN artifact
- **Path:** `runs/explain-implement.json`
- **Host:** `db.xrmbizsvdbdzecyopirs.supabase.co` (Supabase direct)
- **Workspace:** `01KT7D64WDCDGTHEYK93KEXAPH` (0 embedded chunks at capture time)

### Index inventory (measured)
| Index | Table | Definition |
|-------|-------|------------|
| `memory_chunks_embedding_hnsw_idx` | `memory_chunks` | `USING hnsw (embedding vector_cosine_ops)` — from migration `20250601140000_sprint2_retrieval_index` |

### Plan findings (measured, not fabricated)
| Variant | Execution (ms) | HNSW used | Seq scan on chunks | Indexes selected |
|---------|----------------|-----------|-------------------|------------------|
| `base_precision` | 0.17 | no | no | `memories_workspace_id_idx`, `memory_chunks_memory_id_sequence_key` |
| `expanded_topk` | 0.10 | no | no | same |
| `semantic_memory_filter` | 0.12 | no | no | same |

**Interpretation:** HNSW index is deployed but the planner did not use it because the benchmark workspace has **zero embedded chunks** — the sort/limit path returns empty before vector ordering matters. Timings are sub-millisecond and **not representative** of LAT-001 production load; re-run after ingestion populates embeddings.

### Recommendations (evidence-based only)
1. **No new index migration** — existing HNSW index is correct for `ORDER BY mc.embedding <=> $1::vector` (cosine distance).
2. **Re-run EXPLAIN after ingestion** — confirm HNSW selection when `embeddedChunkCount > 0`.
3. **Do not change topK or similarity thresholds** in this sprint — candidate limits affect ranking determinism.
4. If HNSW is not selected with populated data, tune `hnsw.ef_search` / analyze selectivity before alternate indexes.

### Optional index task
**Not applied.** No measurement proved a new index would improve plans; existing HNSW migration is sufficient pending data-backed re-verification.

### Test runs (2026-06-08)
| Suite | Command | Result |
|-------|---------|--------|
| EXPLAIN helpers | `npx tsx --test scripts/benchmark-pgvector-explain.test.ts` | **4/4 pass** |
| SQL builder | `npx tsx --test packages/retrieval/src/vector-search-sql.test.ts` | **2/2 pass** |
| Live EXPLAIN | `npm run perf:bench-pgvector-explain` | **success** → `runs/explain-implement.json` |

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No index change without measurement | HNSW index already exists from Sprint 2 migration; EXPLAIN showed no seq-scan regression; **no new migration added** |
| No candidate limit changes | Script uses `DEFAULT_RETRIEVAL_RUNTIME_CONFIG` topK values (24/48) read-only; recommendations explicitly forbid threshold/topK edits |
| No fabricated EXPLAIN | All plans captured via `prisma.$queryRawUnsafe('EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) …')` against live Supabase; raw `rawPlan` JSON stored in artifact |
| GA-1 | No retrieval ranking, threshold, or stage-order changes |
| GA-2 | Deterministic SQL builder only; no ML/heuristic tuning |
| GA-3 | No trace payload or dashboard contract changes |
| GA-4 | Timings and plan nodes sourced from Postgres JSON output; empty-workspace caveat documented |
| GA-5 | Scope limited to SQL extraction, benchmark script, tests, and outcomes — no unrelated refactors |
| GA-6 | `stages[]` and trace fields untouched |
| GA-7 | No new tables; index review only |

## Verification summary

Verification ran the sprint testing framework: unit tests for EXPLAIN parsing/plan analysis and SQL builder parity, plus an independent live `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` capture against the configured Supabase database.

### Testing framework

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Repeatable EXPLAIN script | **pass** | `npm run perf:bench-pgvector-explain` → `runs/explain-verify.json` (2026-06-08) |
| 2 | Before/after if index changed | **N/A** | No index migration in sprint; existing HNSW from `20250601140000_sprint2_retrieval_index` only |
| 3 | Link to LAT-001 | **pass** | Artifact `auditRefs.latencyFinding: "LAT-001"`, `mockPgvectorMs: 15.03` |
| 4 | Automated helper coverage | **pass** | `scripts/benchmark-pgvector-explain.test.ts` — **4/4** |
| 5 | SQL parity with production store | **pass** | `packages/retrieval/src/vector-search-sql.test.ts` — **2/2**; `retrieval-vector-store.ts` imports shared `buildVectorSearchSql` |

### Verification runs (2026-06-08)

| Suite | Command | Result |
|-------|---------|--------|
| EXPLAIN helpers | `npx tsx --test scripts/benchmark-pgvector-explain.test.ts` | **4/4 pass** |
| SQL builder | `npx tsx --test packages/retrieval/src/vector-search-sql.test.ts` | **2/2 pass** |
| Live EXPLAIN (verify) | `npm run perf:bench-pgvector-explain -- --output …/runs/explain-verify.json` | **success** |

Live verify capture reproduced implement findings: same workspace (`01KT7D64WDCDGTHEYK93KEXAPH`, 0 embedded chunks), HNSW index present in `pg_indexes`, planner used `memories_workspace_id_idx` + `memory_chunks_memory_id_sequence_key`, HNSW not selected (empty sort path). Timings: `base_precision` 0.19ms, `expanded_topk` 0.11ms, `semantic_memory_filter` 0.11ms.

### Regression check

- **Retrieval ranking / thresholds:** unchanged — `DEFAULT_RETRIEVAL_RUNTIME_CONFIG` still `topKPrecision: 24`, `topKExpanded: 48`, `similarityThreshold: 0.55`.
- **SQL shape:** shared `buildVectorSearchSql()` preserves `ORDER BY mc.embedding <=> $1::vector ASC` and filter predicates; API store delegates to same function.
- **Trace/dashboard contracts:** no changes in sprint scope.

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | EXPLAIN captured for representative queries | **met** | 3 variants (`base_precision`, `expanded_topk`, `semantic_memory_filter`) with `rawPlan` JSON in `runs/explain-implement.json` and `runs/explain-verify.json` |
| 2 | Index usage documented | **met** | HNSW inventory from `pg_indexes`; per-variant `indexNames`, `usesHnswIndex`, `usesSeqScanOnChunks`, `planSummary` in artifacts |
| 3 | Recommendations evidence-based only | **met** | `recommendations[]` derived from measured plans (empty-workspace HNSW skip, no seq scan, no topK edits); no index migration shipped |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No index change without measurement | **no** | No new migrations; optional index task explicitly not applied |
| No candidate limit changes | **no** | Script reads `DEFAULT_RETRIEVAL_RUNTIME_CONFIG` topK (24/48); contracts unchanged |
| No fabricated EXPLAIN | **no** | Independent verify run produced Postgres JSON plans; `rawPlan` nodes match live console output |
| GA-1 (ranking/stage order) | **no** | SQL extraction only; no pipeline edits |
| GA-2 (non-deterministic tuning) | **no** | Deterministic SQL builder + EXPLAIN harness |
| GA-3 (trace payload breaks) | **no** | No dashboard/historian contract changes |
| GA-4 (fabricated numbers) | **no** | Timings sourced from `Execution Time` in EXPLAIN JSON; empty-workspace caveat documented |
| GA-5 (scope creep) | **no** | Changes limited to SQL extraction, benchmark script, tests, outcomes |
| GA-6 (`stages[]` removal) | **no** | Trace fields untouched |
| GA-7 (new tables) | **no** | Index review only |

## Verification Score
- **Score:** 94 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown**

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with artifact + live re-run evidence |
| Anti-objectives clean | 25% | 25 | No sprint or global anti-objective violations |
| Test coverage | 20% | 18 | Unit tests cover parsing/analysis/SQL shape; live DB path is manual/repeatable only |
| Regression safety | 15% | 11 | SQL parity verified; HNSW planner selection under populated data still unconfirmed |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| pgvector EXPLAIN evidence | none (audit: "no EXPLAIN") | 3 variant plans + index inventory | evidence-based pgvector plan | `runs/explain-implement.json`, `runs/explain-verify.json` |
| HNSW index present | assumed (migration) | confirmed via `pg_indexes` | index documented | artifact `indexes[]` |
| `base_precision` execution (ms) | LAT-001 mock 15.03 | **0.19** verify / **0.17** implement (empty workspace; not comparable) | understand plan shape | `variants[0].executionTimeMs` in both artifacts |
| Index used in plan | unknown | `memories_workspace_id_idx` + chunk FK index; HNSW deferred (0 rows) | index usage documented | `variants[].planSummary`, `usesHnswIndex: false` |
| Repeatable harness | none | `npm run perf:bench-pgvector-explain` | repeatable EXPLAIN | `scripts/benchmark-pgvector-explain.ts` |

## Places for improvement

1. **Re-run after ingestion** — benchmark workspace has 0 embedded chunks; HNSW selection under LAT-001 load remains unverified until data exists (script auto-picks workspace with most chunks when available).
2. **Document harness in performance-testing.md** — add `perf:bench-pgvector-explain` to `docs/testing/performance-testing.md` for discoverability.
3. **Optional CI guard** — import-only test asserting `PGVECTOR_EXPLAIN_VARIANTS` count and LAT-001 audit refs without requiring `DATABASE_URL`.
