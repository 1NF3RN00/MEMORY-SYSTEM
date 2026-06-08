# Sprint-09 Outcomes — LLM Audit Full Route Coverage

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** PBUG-002, OP-15
- **Priority:** P1
- **Effort:** <1 day

## Implementation summary

Audited all `createOpenAi*` call sites in `apps/api` and wrapped the four remaining HTTP handlers that invoked OpenAI clients without an active `LlmCallCollector` ALS scope.

### Route inventory (100% coverage)

| Route / path | OpenAI operation(s) | ALS wrapper | Response audit surface |
|--------------|---------------------|-------------|------------------------|
| `POST /retrieve` | `embedding` | `runWithTimingAsync(..., request.llmCallCollector)` | `llmCallAudit` in body |
| `POST /compress` | `compression_abstraction` | `runWithLlmCallAsync` | `llmCallAudit` in body |
| `POST /workflows/:id/execute` | `embedding`, `workflow_analysis` | `runWithLlmCallAsync` | `llmCallAudit` in body |
| `POST /retrieval/plan` | none (deterministic) | `runWithTimingAsync(..., request.llmCallCollector)` | `llmCallAudit` (empty `calls[]`) |
| `POST /replay/benchmark` | `embedding`, `compression_abstraction` | `runWithLlmCallAsync` **(added)** | `llm.audit.completed` via middleware |
| `POST /calibration/benchmark` | `embedding`, `compression_abstraction` | `runWithLlmCallAsync` **(added)** | `llm.audit.completed` via middleware |
| `POST /observations` | `embedding` | `runWithLlmCallAsync` **(added)** | `llm.audit.completed` via middleware |
| `POST /observation-providers/:providerKey/collect` | `embedding` | `runWithLlmCallAsync` **(added)** | `llm.audit.completed` via middleware |
| Worker ingestion jobs | `embedding` | `runWithLlmCallAsync` (per-job collector) | `llm.audit.completed` via `emitLlmCallAudit` |

**Indirect call sites (covered by parent scope):**

| Module | Invoked from | Notes |
|--------|--------------|-------|
| `lib/workflow-retrieval.ts` | `POST /workflows/:id/execute` | Embedding runs inside workflow `runWithLlmCallAsync` |

### Files changed

- `apps/api/src/routes/historian.ts` — wrap `POST /replay/benchmark`
- `apps/api/src/routes/diagnostics.ts` — wrap `POST /calibration/benchmark`
- `apps/api/src/routes/observations.ts` — wrap `POST /observations`
- `apps/api/src/routes/observation-providers.ts` — wrap provider collect handler
- `apps/api/src/routes/sprint-09-llm-audit-route-coverage.test.ts` — static route-coverage tests (new)

### Evidence

- `recordLlmCall()` in `packages/observability/src/llm/record.ts` returns `undefined` when no ALS collector is active; wrapping ensures calls are recorded instead of silently dropped.
- `registerRequestTiming` `onResponse` hook calls `emitLlmCallAudit` for every HTTP response, emitting `llm.audit.completed` when calls were recorded.
- Static + ALS behavior test suite: 15/15 passing (`node --import tsx --test apps/api/src/routes/sprint-09-llm-audit-route-coverage.test.ts`).
- API typecheck passes.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not double-wrap instrumented routes | Only added wrappers to historian, diagnostics, observations, and observation-providers. Pre-wrapped routes (compression, retrieval, workflows, planning, job-processor) left unchanged. |
| Do not change LLM prompts or models | No edits to `packages/ingestion/src/embedding.ts`, `packages/compression/src/abstraction.ts`, or `workflow-analysis-caller.ts`. |
| Do not block requests if collector missing | `runWithLlmCallAsync` always receives `request.llmCallCollector`, which middleware creates on every request. `recordLlmCall` still no-ops safely when collector absent (unchanged behavior). |
| GA-1 | No retrieval ranking, threshold, or stage-order changes. |
| GA-2 | No new ML heuristics or autonomous agents. |
| GA-3 | No trace payload fields removed; existing `llmCallAudit` response shapes on primary routes unchanged. |
| GA-4 | Coverage measured via source audit and static tests; no fabricated latency/token numbers. |
| GA-5 | Scope limited to four route files plus sprint test; no unrelated refactors. |
| GA-6 | No `stages[]` or trace fields removed. |
| GA-7 | No new database tables. |

## Verification summary

Verification extended the sprint test suite with ALS behavior checks (no-op without collector, non-empty `calls[]` inside `runWithLlmCallAsync`), single-wrapper assertions (anti double-wrap), and planning-route `llmCallAudit` surface checks. All tests executed successfully.

### Testing framework

| Suite | Command | Result |
|-------|---------|--------|
| Sprint-09 route coverage | `node --import tsx --test apps/api/src/routes/sprint-09-llm-audit-route-coverage.test.ts` | **15/15 pass** |
| LlmCallCollector unit tests | `node --import tsx --test packages/observability/src/llm/collector.test.ts` | **3/3 pass** |
| API typecheck | `npm run typecheck --workspace=@memory-middleware/api` | **pass** |

### Call-site audit (apps/api)

Repo-wide `createOpenAi*` grep confirms **9 HTTP + 1 worker** invocation surfaces, all parent-scoped:

| Surface | ALS scope | Audit emission |
|---------|-----------|----------------|
| `POST /retrieve` | `runWithTimingAsync(..., request.llmCallCollector)` | `llmCallAudit` in body + middleware `emitLlmCallAudit` |
| `POST /compress` | `runWithLlmCallAsync` | `llmCallAudit` in body + middleware |
| `POST /workflows/:id/execute` | `runWithLlmCallAsync` | `llmCallAudit` in body + middleware |
| `POST /retrieval/plan` | `runWithTimingAsync(..., request.llmCallCollector)` | `llmCallAudit` (empty `calls[]`) + middleware |
| `POST /replay/benchmark` | `runWithLlmCallAsync` **(added)** | middleware `llm.audit.completed` when calls recorded |
| `POST /calibration/benchmark` | `runWithLlmCallAsync` **(added)** | middleware |
| `POST /observations` | `runWithLlmCallAsync` **(added)** | middleware |
| `POST /observation-providers/:providerKey/collect` | `runWithLlmCallAsync` **(added)** | middleware |
| Worker ingestion jobs | `runWithLlmCallAsync` + per-job collector | direct `emitLlmCallAudit` in `job-processor.ts` |

Indirect: `lib/workflow-retrieval.ts` embedding runs inside workflow execute ALS scope.

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | All OpenAI invocations record on instrumented routes | **met** | 9/9 HTTP routes + worker each have exactly one ALS wrapper (test 11); all `createOpenAi*` apps/api call sites parent-scoped; `runWithLlmCallAsync` + `recordLlmCall` produces non-empty `calls[]` (test 13) |
| 2 | llmCallAudit or llm.audit.completed emitted | **met** | Primary routes return `llmCallAudit` in body (compression, retrieval, workflows, planning); `registerRequestTiming` `onResponse` calls `emitLlmCallAudit` (test 15); `emit.ts` logs `llm.audit.completed` (test 15); worker calls `emitLlmCallAudit` directly (test 9) |
| 3 | No silent recordLlmCall no-ops | **met** | `recordLlmCall` returns `undefined` without ALS (test 12, `record.ts`); every OpenAI call site now runs inside ALS scope established by route/worker wrappers |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not double-wrap instrumented routes | **no** | Each LLM route file has exactly one wrapper (test 11); pre-wrapped routes unchanged |
| Do not change LLM prompts or models | **no** | No edits to `embedding.ts`, `abstraction.ts`, or `workflow-analysis-caller.ts` prompt/model strings |
| Do not block requests if collector missing | **no** | Middleware always assigns `request.llmCallCollector` on `onRequest`; `recordLlmCall` still safe no-op when absent |
| GA-1 (ranking/thresholds) | **no** | Wrapper-only diff; no retrieval pipeline edits |
| GA-2 (non-deterministic tuning) | **no** | No new heuristics or agents |
| GA-3 (trace payload compat) | **no** | Existing `llmCallAudit` response shapes on primary routes preserved |
| GA-4 (fabricated numbers) | **no** | Coverage measured via source audit + automated tests |
| GA-5 (scope creep) | **no** | Four route files + sprint test only |
| GA-6 (stages[] removal) | **no** | No trace field removals |
| GA-7 (new DB tables) | **no** | No schema changes |

### Regression check
Retrieval/compression ranking, prompts, and models unchanged. Sprint scope limited to ALS wrapping and audit emission paths.

## Verification Score
- **Score:** 94 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated + source evidence |
| Anti-objectives clean | 25% | 25 | No sprint or global anti-objective violations found |
| Test coverage | 20% | 17 | Strong static + ALS behavior coverage; no per-route HTTP integration with mocked OpenAI |
| Regression safety | 15% | 12 | Wrapper-only change; no runtime before/after output diff captured |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| coverage | 5/9 HTTP LLM routes wrapped (56%) | 9/9 HTTP LLM routes wrapped (100%) | 100% instrumented routes | Route inventory table; sprint-09 tests 15/15 pass |
| ALS wrapper count per route | N/A (unverified) | 1 per LLM route file | No double-wrap | Test 11: single `runWithLlmCallAsync`/`runWithTimingAsync` per file |
| recordLlmCall without ALS | returns `undefined` (silent no-op) | unchanged behavior; routes now scoped | No silent drops on instrumented paths | Test 12 + test 13 |
| Test suite size | 11 tests (implementation) | 15 tests (verification) | Objectives covered by repeatable tests | Extended sprint-09 suite |

## Places for improvement
- Add HTTP-level integration tests (mocked OpenAI) per route to assert `llmCallAudit.calls.length > 0` at runtime, not only via source/ALS unit checks.
- Assert `llm.audit.completed` event emission in a middleware integration test (currently verified via source match on `emit.ts`).
- Capture a before/after replay benchmark snapshot to document retrieval/compression output identity explicitly.
