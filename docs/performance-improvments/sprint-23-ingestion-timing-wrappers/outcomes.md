# Sprint-23 Outcomes — Ingestion Pipeline Timing Wrappers

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-22, MF-005
- **Priority:** P2
- **Effort:** 3-5 days

## Implementation summary

Wrapped `runIngestionPipeline` with the shared `ExecutionTimingCollector` pattern used by retrieval and context-delivery:

1. **`PipelineOptions.timingCollector`** — optional collector passed from callers; resolved via `resolvePipelineCollector(input.traceId, options.timingCollector)`.
2. **Stage wrappers** — `measurePipelineStage` at four audit boundaries:
   - `ingestion` — entire pipeline
   - `normalization` — website crawl (when applicable), `normalizeContent()`, and `persistSourceTruth()`
   - `chunking` — fixed-chunk path or structural chunking block
   - `embedding_generation` — `embedChunks()`
3. **Worker wiring** — `apps/api/src/lib/job-processor.ts` passes `collectors.timingCollector` into `runIngestionPipeline`; existing `emitWorkerJobAudits` → `emitTimingAudit` emits `timing.audit.completed` after each job (unchanged from sprint-35, now includes ingestion sub-stages).
4. **Tests**
   - `packages/ingestion/src/pipeline-timing.test.ts` — stage coverage, legacy stage preservation, output parity with/without collector
   - `apps/api/src/lib/sprint-23-ingestion-timing-wrappers.test.ts` — source-level wiring checks

**Evidence (test run):**
```
npx tsx --test packages/ingestion/src/pipeline-timing.test.ts  → 3/3 pass
npx tsx --test apps/api/src/lib/sprint-23-ingestion-timing-wrappers.test.ts → 2/2 pass
```

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No ingestion output change | `pipeline-timing.test.ts` asserts identical memory content, chunk text, embeddings, and chunking strategy with vs without `timingCollector`; no changes to normalization/chunking/embedding algorithms |
| Keep Date.now() records | All existing `stage()` calls, `IngestionStageRecord.latencyMs`, event `latencyMs`, and `buildCanonicalMemory` latency fields unchanged; wrappers are additive |
| Minimal overhead | `measurePipelineStage` no-ops when collector is absent; high-resolution timing only when collector is provided |
| GA-1 | No ranking, threshold, or stage-order changes — instrumentation only |
| GA-2 | No ML/heuristic tuning |
| GA-3 | Legacy `IngestionStageRecord[]` and event payloads unchanged; new timing data goes to `ExecutionTimingAudit` only |
| GA-4 | No performance numbers fabricated; evidence is automated test output |
| GA-5 | Scope limited to `packages/ingestion/src/pipeline.ts`, `job-processor.ts`, and sprint tests |
| GA-6 | All existing `stages[]` push/update calls preserved |
| GA-7 | No new database tables |

## Verification summary

Verification ran the sprint test suite plus complementary sprint-35 worker observability tests. All 15 tests passed.

### Testing framework

| Check | Result | Evidence |
|-------|--------|----------|
| Job log has timingAudit | **partial** | `job-processor.ts` calls `emitTimingAudit(..., collectors.timingCollector.toAudit(), ...)` after each job; `emit.ts` logs `timing.audit.completed` with full `stages[]`. Verified structurally via sprint-23 and sprint-35 source tests; no live worker job log capture in this sprint. |
| Stage names match contract | **met** | `pipeline-timing.test.ts` asserts `ingestion`, `normalization`, `chunking`, `embedding_generation`; names match `ExecutionStageName` in `packages/shared-types/src/execution-timing-contracts.ts`. |
| Output identical | **met** | `pipeline-timing.test.ts` "produces identical memory output with or without timingCollector" — normalized content, title, chunk count/text, embeddings, and chunking strategy all equal. |

### Test runs (verification agent)

```
npx tsx --test packages/ingestion/src/pipeline-timing.test.ts apps/api/src/lib/sprint-23-ingestion-timing-wrappers.test.ts
→ 5/5 pass (2 suites)

npx tsx --test apps/api/src/lib/sprint-35-worker-observability-scopes.test.ts
→ 10/10 pass (complementary worker audit emission coverage)
```

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All ingestion stages in timingAudit | **met** | `pipeline-timing.test.ts` records collector with all four stages; nested duration ordering validated (`ingestion` ≥ sub-stages). |
| 2 | Worker emits timing.audit.completed | **met** | `job-processor.ts` → `emitWorkerJobAudits` → `emitTimingAudit` → `timing.audit.completed` (logger + events). Sprint-23 source test confirms `timingCollector: collectors.timingCollector` wiring; sprint-35 confirms post-job emission and partial-audit behavior on failure. |
| 3 | Legacy records preserved | **met** | `pipeline-timing.test.ts` asserts legacy stages `normalized`, `chunked`, `embedded`, `stored`, `completed` with valid `latencyMs` and `startedAt`/`completedAt` ordering. Sprint-23 source test confirms `Date.now() - normStarted/chunkStarted/pipelineStarted` retained. |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No ingestion output change | **no** | Deep-equal memory/chunk/embedding parity test passes. |
| Keep Date.now() records | **no** | Legacy `stage()` pushes and event `latencyMs` unchanged; source grep confirms `Date.now()` patterns remain. |
| Minimal overhead | **no** | `measurePipelineStage` returns `fn()` immediately when collector is absent (`packages/observability/src/timing/pipeline.ts`); no collector required for callers. |

### Global anti-objectives (GA-1 – GA-7)
| ID | Violated? | Evidence |
|----|-----------|----------|
| GA-1 | **no** | Instrumentation-only wrappers; no ranking/threshold/stage-order changes. |
| GA-2 | **no** | No ML/heuristic tuning added. |
| GA-3 | **no** | Legacy `IngestionStageRecord[]` and ingestion events unchanged; new data only in `ExecutionTimingAudit`. |
| GA-4 | **no** | All evidence from automated test output; no fabricated latency numbers. |
| GA-5 | **no** | Changes scoped to ingestion pipeline, job-processor wiring, and sprint tests. |
| GA-6 | **no** | All existing `stages[]` push/update calls preserved in `pipeline.ts`. |
| GA-7 | **no** | No new database tables. |

### Regression
Retrieval/compression outputs unchanged — sprint scope is ingestion instrumentation only; no retrieval or compression code modified.

## Verification Score
- **Score:** 97 / 100
- **Objectives met:** 3/3
- **Anti-objectives violated:** none

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated evidence |
| Anti-objectives clean | 25% | 25 | No violations detected |
| Test coverage | 20% | 17 | Strong pipeline behavioral tests; worker emission verified structurally, not end-to-end with live job log |
| Regression safety | 15% | 15 | Output parity test confirms identical ingestion artifacts |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| observability | ingestion stages only in legacy `IngestionStageRecord` + events | unified `ExecutionTimingAudit` with `ingestion`, `normalization`, `chunking`, `embedding_generation` | ingestion in unified audit | `pipeline-timing.test.ts` stage assertions (4/4 stages present) |
| test pass rate | — | 5/5 sprint tests, 10/10 sprint-35 complementary | all green | verification test runs above |
| output parity | — | identical with/without collector | no ingestion output change | `pipeline-timing.test.ts` deep-equal assertions |

## Places for improvement

1. **End-to-end worker integration test** — run `processNextIngestionJob` (or a mocked prisma/events harness) and assert the emitted `timing.audit.completed` log/event contains ingestion sub-stages, not only `worker_job:claim` / `worker_job:ingestion`.
2. **Contract assertion in sprint-23 source test** — import `ExecutionStageName` union or shared contract and assert stage strings match the canonical list instead of regex-only checks.
3. **Before/after latency baseline** — optional micro-benchmark confirming collector-absent path overhead is negligible (not required for observability sprint, but would close the measurements gap).
