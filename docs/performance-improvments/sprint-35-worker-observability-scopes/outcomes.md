# Sprint-35 Outcomes — Worker Job Observability Scopes

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** AR-004
- **Priority:** P1
- **Effort:** 3-5 days

## Implementation summary

### 1. Extended `job-processor` with full observability scopes (`apps/api/src/lib/job-processor.ts`)

- `processNextIngestionJob` now creates paired collectors keyed to `job.traceId`:
  - `ExecutionTimingCollector(job.traceId)` for timing audits
  - `LlmCallCollector(job.traceId)` for LLM call audits
- Scope nesting order (innermost → outermost):
  1. `runWithTimingAsync` — carries timing + LLM ALS for `recordLlmCall` in embedding client
  2. `runWithDbObservationScope({ scopeId: job.traceId, scopeType: "worker" })` — captures all Prisma queries in the job tick
- Worker timing stages: `worker_job:claim` (status transition) and `worker_job:ingestion` (pipeline body).
- `emitWorkerJobAudits` emits all three audit types after every job tick (success or failure):
  - `timing.audit.completed` via `emitTimingAudit`
  - `llm.audit.completed` via `emitLlmCallAudit`
  - `database.scope.completed` via `emitDbScopeCompleted`

### 2. DB scope wrap (sprint-07/08 dependency)

- Retained `runWithDbObservationScope` with `scopeType: "worker"` and `scopeId: job.traceId`.
- Uses `loadDbObservabilityEnv()` thresholds (`DB_SLOW_QUERY_MS`, `DB_N_PLUS_ONE_THRESHOLD`, `DB_LEADERBOARD_SIZE`).
- DB summary pushed to in-memory leaderboard on emit (same path as HTTP scopes).

### 3. traceId correlation

| Stage | traceId source | Event / audit field |
|-------|----------------|---------------------|
| API `POST /ingest` | `X-Trace-Id` header if valid ULID, else `newUlid()` | `ingestionJob.traceId`, `ingestionTrace.traceId` |
| Worker claim | `job.traceId` from DB row | `timing.requestId`, `llm.requestId`, `db.scopeId` |
| EventLog emission | `job.traceId` | `trace_id` on `timing.audit.completed`, `llm.audit.completed`, `database.scope.completed` |

API and worker are separate Node processes (`index.ts` vs `worker-main.ts`); correlation is via the shared ULID persisted on the ingestion job at enqueue time.

### 4. Tests

- Contract + behavioral suite: `apps/api/src/lib/sprint-35-worker-observability-scopes.test.ts` (10 tests after verification extension).
- Updated sprint-09 regression assertion for worker path (`runWithTimingAsync` + nested `LlmCallCollector` replaces direct `runWithLlmCallAsync`).

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Same traceId scheme | All three collectors and event emissions use `job.traceId` (ULID from ingest route); no new ID format introduced |
| Audit fail non-blocking | `emitWorkerJobAudits` wraps each emit in `emitSafe` try/catch; failures log `worker.audit.emit_failed` without affecting job status updates |
| Separate processes OK | Worker remains a standalone process in `worker-main.ts`; scopes are per-job ALS, not cross-process shared state |
| GA-1 (ranking/threshold changes) | No retrieval, compression, or ingestion algorithm changes; instrumentation only |
| GA-2 (non-deterministic tuning) | No ML/heuristics; deterministic stage names and existing collector contracts |
| GA-3 (trace payload breakage) | Additive audit events only; existing ingestion `stages[]` on `ingestionTrace` unchanged |
| GA-4 (fabricated numbers) | Tests assert wiring and collector correlation; no performance claims without measurement |
| GA-5 (scope creep) | Changes limited to `job-processor.ts`, one test file, one sprint-09 assertion update |
| GA-6 (removing trace fields) | No `stages[]` or historian fields removed |
| GA-7 (new DB tables) | Reuses EventLog via existing emit helpers and in-memory leaderboard |

## Verification summary

Verification agent extended the sprint-35 test suite with three additional cases (full audit emission, failed-job non-rethrow contract, failed-job partial timing stages) and ran the full regression bundle.

### Testing framework

| Check | Result | Evidence |
|-------|--------|----------|
| 1. Job log full audit | **pass** | Tests 1, 2, 8 assert `emitTimingAudit`, `emitLlmCallAudit`, `emitDbScopeCompleted` fire after scoped execution; test 7 behavioral run confirms all three collector types share `traceId` |
| 2. traceId matches API | **pass** | Test 5: ingest route resolves ULID via `isUlid` → `resolvedTraceId` on job row; worker uses `job.traceId` on all collectors; test 7 behavioral asserts `requestId` / `scopeId` match |
| 3. Failed job partial audit | **pass** | Tests 9–10: `processIngestionJobBody` catches without rethrow; `emitWorkerJobAudits` sits outside scope callback; behavioral test confirms claim + ingestion stages retained on simulated pipeline failure |

### Test commands (2026-06-08)

```bash
node --import tsx --test apps/api/src/lib/sprint-35-worker-observability-scopes.test.ts
# → 10/10 pass

node --import tsx --test \
  apps/api/src/lib/sprint-35-worker-observability-scopes.test.ts \
  apps/api/src/routes/sprint-08-db-observability-phase-four.test.ts \
  apps/api/src/routes/sprint-09-llm-audit-route-coverage.test.ts
# → 30/30 pass (sprint-35: 10, sprint-08: 5, sprint-09: 15)
```

### Regression safety

- No changes to retrieval, compression, or ranking pipelines.
- Sprint-08 worker DB scope assertions still pass (instrumented Prisma + `runWithDbObservationScope`).
- Sprint-09 worker LLM audit wiring regression passes.

### Objective results

| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Worker emits timing and llm audits | **met** | `emitWorkerJobAudits` calls `emitTimingAudit` + `emitLlmCallAudit`; collectors created with `job.traceId`; tests 1, 2, 7, 8, 10 pass |
| 2 | DB scope when sprint-07 landed | **met** | `runWithDbObservationScope({ scopeId: job.traceId, scopeType: "worker" })` wraps full job tick; `emitDbScopeCompleted` on completion; sprint-08 test 3 + sprint-35 tests 1, 7, 8 pass |
| 3 | traceId correlates | **met** | Ingest persists ULID on job; worker collectors + DB scope use same `job.traceId`; behavioral test 7/10 assert `requestId` / `scopeId` equality |

### Anti-objective results

| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Same traceId scheme | **no** | ULID from ingest route → `job.traceId` → all audit `requestId` / `scopeId` fields; no alternate ID format |
| Audit fail non-blocking | **no** | `emitSafe` per audit type logs `worker.audit.emit_failed`; job status updates in `processIngestionJobBody` catch are independent |
| Separate processes OK | **no** | `worker-main.ts` standalone entry with `service: "worker"`; ALS scopes are per-tick, not shared cross-process |
| GA-1 | **no** | Instrumentation-only diff in `job-processor.ts` |
| GA-2 | **no** | Deterministic stage names; existing collector contracts |
| GA-3 | **no** | Additive audit events; `ingestionTrace.stages[]` untouched |
| GA-4 | **no** | Measurements cite test pass counts only |
| GA-5 | **no** | Scope limited to worker observability wiring |
| GA-6 | **no** | No trace/historian fields removed |
| GA-7 | **no** | EventLog + in-memory leaderboard only |

## Verification Score

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 100 | 3/3 met with automated evidence |
| Anti-objectives clean | 25% | 100 | Sprint + GA-1–GA-7: no violations |
| Test coverage | 20% | 85 | Contract + behavioral coverage for all objectives; no E2E EventLog integration test |
| Regression safety | 15% | 100 | 30/30 regression bundle pass; no algorithm changes |

- **Score:** 95 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

## Measurements

| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| observability | timing audit absent on worker | timing + llm + db audits per job tick | ingestion job audit | `emitWorkerJobAudits`; sprint-35 tests 10/10; regression 30/30 |
| test coverage | 0 sprint-35 tests | 10 contract + behavioral tests | objectives covered | `sprint-35-worker-observability-scopes.test.ts` |
| traceId correlation | worker audits uncorrelated | `job.traceId` on timing, llm, db scopes | API ↔ worker correlation | ingest route ULID persistence + behavioral test 7 |

## Places for improvement

1. **Integration test gap:** Add a worker tick test against a test database that asserts `EventLog` rows for `timing.audit.completed`, `llm.audit.completed`, and `database.scope.completed` with matching `trace_id`.
2. **Logger-absent edge case:** `emitWorkerJobAudits` returns early when `logger` is undefined; add a contract test or document that worker-main always supplies a logger.
3. **Overhead measurement:** Capture per-job audit emission latency (ms) in a perf-wave or benchmark run to quantify instrumentation cost.
