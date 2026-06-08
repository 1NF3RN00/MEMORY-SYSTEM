# Sprint-36 Outcomes — Execution Timing Completion

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** EXECUTION_TIMING
- **Priority:** P2
- **Effort:** 1 week

## Implementation summary

Completed optional execution-timing coverage for context-delivery, relationship graph routes, and remaining major pipeline routes.

### Changes shipped

| Area | File(s) | What was added |
|------|---------|----------------|
| Context delivery pipeline | `packages/context-delivery/src/pipeline.ts` | Optional `timingCollector`; entire render wrapped in `measurePipelineStage(..., "context_rendering", ...)` |
| Context render route | `apps/api/src/routes/context.ts` | `POST /context/render` wrapped in `runWithTimingAsync`; passes `timingCollector`; returns `timingAudit` |
| Compression route | `apps/api/src/routes/compression.ts` | Upgraded `POST /compress` from `runWithLlmCallAsync` to `runWithTimingAsync` (LLM ALS preserved); passes `timingCollector` to pipeline; returns `timingAudit` |
| Relationship graph routes | `apps/api/src/routes/relationships.ts` | `graph_traversal` via `measureAsync` on neighborhood + cluster endpoints |
| Relationship graph API | `apps/api/src/routes/compression.ts` | `GET /relationships/graph` wrapped with `graph_traversal` timing |
| Tests | `packages/context-delivery/src/pipeline-timing.test.ts`, `apps/api/src/routes/sprint-36-execution-timing-completion.test.ts` | Pipeline stage assertion + route coverage / gap audit |
| Sprint-09 compatibility | `apps/api/src/routes/sprint-09-llm-audit-route-coverage.test.ts` | Compression route now listed under `runWithTimingAsync` timing+LLM pattern |

### Route coverage matrix (post-sprint)

| Route | `api_handler` (global middleware) | Pipeline / domain stage timing | `timingAudit` in body |
|-------|-----------------------------------|-------------------------------|----------------------|
| `POST /retrieve` | yes | retrieval pipeline + `fact_resolution` | yes |
| `POST /retrieval/plan` | yes | planning pipeline | yes |
| `POST /compress` | yes | `compression` umbrella | yes |
| `POST /context/render` | yes | `context_rendering` | yes |
| `GET /relationships/:id/neighborhood` | yes | `graph_traversal` | logs only |
| `GET /clusters/:workspaceId` | yes | `graph_traversal` | logs only |
| `GET /relationships/graph` | yes | `graph_traversal` | logs only |
| All other routes | yes (`request-timing.ts`) | — | — |

### Documented gaps (intentional)

| Route group | Why not wrapped |
|-------------|-----------------|
| `health`, `auth`, `access`, `platform` | No pipeline work; `api_handler` sufficient |
| `ingest` (`POST /ingest`) | Enqueues async worker job; timing emitted from worker (`sprint-35`) |
| `ingestion/*`, `memory/*`, `search/*`, `workspaces/*` | Read/list CRUD; no deterministic pipeline stages |
| `workflows/*`, `historian/*`, `diagnostics/*`, `observations/*` | LLM-audit scoped (`sprint-09`); no full pipeline timing unless chained retrieval/compression |
| `GET /relationships/:memoryId`, `POST /relationships/generate`, `GET /augmentation/:traceId` | Relationship listing/generation — not graph traversal; left for future `relationship_expansion` route timing if needed |
| Ingestion pipeline (`packages/ingestion`) | Out of sprint-36 scope per audit “remaining optional” list; worker path partially covered |

### Evidence

- `packages/context-delivery/src/pipeline-timing.test.ts` — `context_rendering` stage recorded
- `apps/api/src/routes/sprint-36-execution-timing-completion.test.ts` — 9/9 passing (major routes, graph routes, gap audit)
- `apps/api/src/routes/sprint-09-llm-audit-route-coverage.test.ts` — still passing after compression upgrade

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No behavior change | Only `measureAsync` / `measurePipelineStage` wrappers added; no algorithm, threshold, or ordering changes |
| Keep legacy stages | `ContextRenderStageRecord`, `CompressionStageRecord`, etc. unchanged; `timingAudit` is additive |
| No double-count | Route `api_handler` (middleware) and pipeline stages are hierarchical siblings, not nested duplicates; graph routes use single `graph_traversal` wrap per handler |
| GA-1 | No retrieval ranking / stage ordering changes |
| GA-2 | No ML heuristics or autonomous tuning |
| GA-3 | Trace payloads unchanged; only optional `timingAudit` added on pipeline POST responses |
| GA-4 | No fabricated latency numbers; tests assert stage presence only |
| GA-5 | Scope limited to context-delivery, relationships graph routes, compression/context route wiring |
| GA-6 | All existing `stages[]` arrays preserved |
| GA-7 | No new database tables |

## Verification summary

Verification ran the sprint-36 route coverage test suite, context-delivery pipeline timing test, sprint-09 LLM/timing compatibility tests, and observability collector unit tests. All passed.

### Testing framework

| Check | Result | Command / artifact |
|-------|--------|-------------------|
| 1. Context render stages | **pass** | `npx tsx --test packages/context-delivery/src/pipeline-timing.test.ts` — `context_rendering` in `collector.toAudit().stages` |
| 2. Graph routes timed | **pass** | `npx tsx --test apps/api/src/routes/sprint-36-execution-timing-completion.test.ts` — `measureAsync("graph_traversal")` in `relationships.ts` + `compression.ts` |
| 3. Log samples | **pass (structural)** | `emitTimingAudit` emits `timing.audit.completed` with `stages[]` per request; graph routes inherit middleware emission on `onResponse` (see sample below) |
| Sprint-09 regression | **pass** | 15/15 tests in `sprint-09-llm-audit-route-coverage.test.ts` (compression still single `runWithTimingAsync`) |
| Collector semantics | **pass** | `packages/observability/src/timing/collector.test.ts` — `totalLatency` is wall-clock, not sum of stages |

**Commands run (2026-06-08):**

```text
npx tsx --test packages/context-delivery/src/pipeline-timing.test.ts          # 1/1 pass
npx tsx --test apps/api/src/routes/sprint-36-execution-timing-completion.test.ts  # 9/9 pass
npx tsx --test apps/api/src/routes/sprint-09-llm-audit-route-coverage.test.ts     # 15/15 pass
npx tsx --test packages/observability/src/timing/collector.test.ts           # 2/2 pass
```

### Log sample shape (graph route via middleware)

Graph GET routes do not return `timingAudit` in the response body; timing is emitted on every response by `registerRequestTiming` → `emitTimingAudit`. Representative audit payload after a neighborhood request:

```json
{
  "requestId": "<traceId>",
  "totalLatency": 42,
  "stages": [
    { "stage": "query_received", "durationMs": 0 },
    { "stage": "api_handler:GET /relationships/:memoryId/neighborhood", "durationMs": 38 },
    { "stage": "graph_traversal", "durationMs": 12 },
    { "stage": "response", "durationMs": 0 }
  ]
}
```

`totalLatency` reflects wall-clock request time; nested stages (`graph_traversal` inside `api_handler`) are breakdown entries, not additive totals.

Pipeline POST routes additionally return `timingAudit` in the JSON body (`/compress`, `/context/render`, `/retrieve`, `/retrieval/plan`).

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | context_rendering and graph_traversal timed | **yes** | `pipeline-timing.test.ts`; `measurePipelineStage(..., "context_rendering")` in `packages/context-delivery/src/pipeline.ts`; `measureAsync("graph_traversal")` on neighborhood, clusters, and workspace graph routes |
| 2 | api_handler on major routes | **yes** | Global `registerRequestTiming` middleware sets `api_handler:{method} {route}` per request (`request-timing.ts`); sprint-36 test asserts pattern |
| 3 | Gaps documented | **yes** | Implementation gap matrix in this file; sprint-36 gap-audit test validates all routes without `runWithTimingAsync`/`measureAsync` are in the expected set |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No behavior change | **no** | Only timing wrappers added; no ranking/threshold/ordering edits in pipeline logic |
| Keep legacy stages | **no** | `ContextRenderStageRecord` `rendering` / `fact_precedence` / etc. unchanged in `pipeline.ts`; `timingAudit` is additive |
| No double-count | **no** | `ExecutionTimingCollector.toAudit().totalLatency` uses request wall-clock (`requestStartHr` → now), not sum of stages; sprint-09 confirms single ALS wrap per LLM route |
| GA-1 | **no** | No retrieval ranking changes |
| GA-2 | **no** | Instrumentation only |
| GA-3 | **no** | Trace payloads unchanged; optional `timingAudit` on POST responses only |
| GA-4 | **no** | Tests assert stage presence/duration ≥ 0, no fabricated benchmarks |
| GA-5 | **no** | Scope limited to context-delivery, relationships graph routes, compression/context wiring |
| GA-6 | **no** | All existing `stages[]` arrays preserved |
| GA-7 | **no** | No new database tables |

## Verification Score
- **Score:** 98 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown:** Objectives 40/40 · Anti-objectives 25/25 · Test coverage 19/20 · Regression safety 14/15

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Major pipeline routes with `timingAudit` | 2 (`/retrieve`, `/retrieval/plan`) | 4 (+ `/compress`, `/context/render`) | major pipelines timed | sprint-36 route matrix tests (4/4 pass) |
| `context_rendering` instrumented | legacy `rendering` stage only | hrtime `context_rendering` in collector | timed | `pipeline-timing.test.ts` (1/1 pass) |
| `graph_traversal` on graph routes | retrieval adjacency only | + neighborhood, clusters, workspace graph | timed | sprint-36 graph route tests (2/2 pass) |
| `api_handler` coverage | all HTTP routes (middleware) | unchanged (global) | major routes | `request-timing.ts` + sprint-36 middleware test |
| Automated sprint-36 tests | 0 | 9 | route + gap coverage | `sprint-36-execution-timing-completion.test.ts` |
| Sprint-09 compatibility | passing | still passing (15 tests) | no regression | run 2026-06-08 |

## Places for improvement

- **Graph routes log-only timing:** neighborhood/clusters/workspace graph emit timing via middleware logs only, not response `timingAudit`. Intentional per implementation matrix; add response body if dashboard needs inline graph timing.
- **No live HTTP integration test:** coverage is static source + unit collector tests; a lightweight Fastify inject test could assert `timingAudit` on `/context/render` end-to-end.
- **Root test runner:** `node --import tsx --test` from repo root fails without `npx tsx`; document workspace test commands in sprint README or root script.
