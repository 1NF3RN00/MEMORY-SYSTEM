# Sprint-26 Outcomes — EXPLAIN ANALYZE Automation

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-25
- **Priority:** P3
- **Effort:** 2-4 weeks

## Implementation summary

Shipped opt-in automated EXPLAIN capture for slow Prisma read queries.

### 1. Slow query hook (`packages/observability/src/database/explain-on-slow.ts`)
- Registers a Prisma `$on('query')` handler when `explainOnSlow` is enabled on the instrumented client.
- Triggers only when `event.duration >= DB_SLOW_QUERY_MS` and SQL is a read (`SELECT` / `WITH`).
- Skips writes (`INSERT`/`UPDATE`/`DELETE`) and nested `EXPLAIN` statements.
- Caps at **3 EXPLAIN captures per scope** to limit overhead.
- Emits `database.query.explain` structured logs with sanitized plan nodes, index names, and `sql_fingerprint` correlated to `scope_id` / `scope_type`.

### 2. EXPLAIN script (`scripts/explain-slow-query.ts`)
- Offline harness: `npm run perf:explain-slow-query -- --sql "SELECT …"` or `--file query.sql`.
- Defaults to `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`; `--no-analyze` for plan-only.
- Reuses observability sanitization helpers; writes JSON report with OP-25 audit refs.

### 3. Environment (`apps/api/src/config/db-observability-env.ts`)
- `DB_EXPLAIN_ON_SLOW` — default `false` (opt-in).
- `DB_EXPLAIN_ANALYZE` — default `false`; when true, runtime hook uses ANALYZE (re-executes query).

### 4. Wiring
- `instrument-prisma.ts` enables Prisma query events and registers the hook when `explainOnSlow` is true.
- `apps/api/src/lib/database.ts` passes env flags into `createInstrumentedPrismaClient`.
- Documented in `docs/PERFORMANCE-AUDITS/DATABASE_QUERY_OBSERVABILITY.md` and `.env.example`.

### Tests run (implementation)
| Suite | Command | Result |
|-------|---------|--------|
| explain-on-slow unit | `npm run test -w @memory-middleware/observability` | **37/37 pass** |
| explain script unit | `npm run perf:test-explain-slow-query` | **4/4 pass** |
| db-observability env | `npx tsx --test apps/api/src/config/db-observability-env.test.ts` | **7/7 pass** |

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No EXPLAIN on writes by default | `isExplainEligibleSql()` accepts only `SELECT`/`WITH`; writes never enter the hook |
| No PII in stored plans | `sanitizeFilterLiteral()` redacts quoted literals and ULID/UUID/CUID values from Filter/Index Cond nodes before logging |
| Low overhead | Feature disabled by default; runtime uses `FORMAT JSON` unless `DB_EXPLAIN_ANALYZE=true`; max 3 captures per scope; EXPLAIN runs async (non-blocking) |
| GA-1 (ranking/threshold changes) | Instrumentation-only — no retrieval ranking, thresholds, or stage ordering changed |
| GA-2 (non-deterministic tuning) | Deterministic SQL fingerprinting and explicit env flags only |
| GA-3 (trace payload breakage) | Explain plans emitted in separate log events; `DbQueryRecord` / retrieval `dbObservability` shapes unchanged |
| GA-4 (fabricated numbers) | Plans produced by live Postgres `EXPLAIN`; script stores raw sanitized JSON from database |
| GA-5 (scope creep) | Limited to observability package hook, env config, script, and docs |
| GA-6 (trace field removal) | No `stages[]` or existing trace fields removed |
| GA-7 (new tables) | Logs + optional JSON script output only; no migrations |

## Verification summary

Verification agent ran the sprint-26 test matrix on 2026-06-08 and added behavioral coverage for the slow-query hook (`sprint-26-verify.test.ts`).

### Testing framework

| # | Checklist item | Test / evidence | Result |
|---|----------------|-----------------|--------|
| 1 | Synthetic slow triggers EXPLAIN | `sprint-26-verify.test.ts` — mock Prisma `$on('query')` + scoped slow SELECT → `database.query.explain` log | **pass** |
| 2 | Disabled by default | `db-observability-env.test.ts` — `DB_EXPLAIN_ON_SLOW` / `DB_EXPLAIN_ANALYZE` default `false`; `instrument-prisma.ts` only registers hook when `explainOnSlow` | **pass** |
| 3 | No regression | `sprint-07-retrieval-db-observability.test.ts` — `dbObservability` contract intact; `overhead.test.ts` — fingerprint path &lt;5ms avg | **pass** |
| 4 | Writes skipped | `explain-on-slow.test.ts` eligibility + `sprint-26-verify.test.ts` INSERT path | **pass** |
| 5 | PII redaction | `explain-on-slow.test.ts` sanitization + verify test asserts no ULID in log payload | **pass** |
| 6 | Per-scope cap | `sprint-26-verify.test.ts` — 5 slow events → 3 EXPLAIN captures | **pass** |
| 7 | Offline script | `explain-slow-query.test.ts` — CLI args, OP-25 audit refs, `runExplainCapture` wiring | **pass** |

### Test runs (verification, 2026-06-08)

| Suite | Command | Result |
|-------|---------|--------|
| Observability (incl. sprint-26 verify) | `npm run test -w @memory-middleware/observability` | **40/40 pass** |
| explain-slow-query script | `npm run perf:test-explain-slow-query` | **4/4 pass** |
| db-observability env | `npx tsx --test apps/api/src/config/db-observability-env.test.ts` | **7/7 pass** |
| Sprint-07 regression | `node --test apps/api/dist/routes/sprint-07-retrieval-db-observability.test.js` | **4/4 pass** |

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Slow queries trigger EXPLAIN when flagged | **met** | `registerSlowQueryExplainHook` gates on `duration >= slowQueryMs` + `isExplainEligibleSql`; `sprint-26-verify.test.ts` fires synthetic 150ms SELECT and asserts `$queryRawUnsafe` called once |
| 2 | Output in logs/diagnostics | **met** | Hook emits `database.query.explain` warn log with `scope_id`, `sql_fingerprint`, `plan_summary`, `index_names`, `explain_plan`; offline script writes JSON report via `runExplainSlowQueryReport` |
| 3 | Opt-in env | **met** | `DB_EXPLAIN_ON_SLOW` / `DB_EXPLAIN_ANALYZE` default `false` in `db-observability-env.ts`; `.env.example` documents flags; `database.ts` passes env into `createInstrumentedPrismaClient` only when enabled |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No EXPLAIN on writes | **no** | `isExplainEligibleSql` rejects INSERT/UPDATE/DELETE; verify test confirms 200ms INSERT does not call EXPLAIN |
| No PII in stored plans | **no** | `sanitizeFilterLiteral` redacts literals/IDs; plan nodes sanitized before log; verify test asserts no ULID in emitted payload |
| Low overhead | **no** | Disabled by default; async non-blocking EXPLAIN; max 3/scope; `overhead.test.ts` avg &lt;5ms for fingerprint+record path |
| GA-1 (ranking/threshold changes) | **no** | Instrumentation-only; sprint-07 retrieval contract tests pass |
| GA-2 (non-deterministic tuning) | **no** | Deterministic `fingerprintSql` + explicit env flags only |
| GA-3 (trace payload breakage) | **no** | Separate `database.query.explain` events; `dbObservability` contract unchanged (sprint-07 4/4) |
| GA-4 (fabricated numbers) | **no** | Tests use mocks/synthetic durations; no latency claims fabricated in outcomes |
| GA-5 (scope creep) | **no** | Changes confined to observability hook, env, script, docs |
| GA-6 (`stages[]` removal) | **no** | No trace field removals |
| GA-7 (unnecessary tables) | **no** | Logs + optional script JSON only |

### Regression
Retrieval/compression outputs unchanged. Sprint-07 `dbObservability` response contract tests pass (4/4). No retrieval ranking, threshold, or pipeline ordering changes in sprint-26 scope.

## Verification Score
- **Score:** 94 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

### Rubric breakdown
| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives verified with automated evidence |
| Anti-objectives clean | 25% | 25 | Sprint + global GA-1–GA-7 clean |
| Test coverage | 20% | 16 | 51 automated tests across observability/env/script; behavioral hook verify added; no live Postgres integration for runtime hook or offline script |
| Regression safety | 15% | 13 | Sprint-07 contracts pass; API `tsc` build has unrelated pre-existing errors outside sprint scope |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| observability | manual EXPLAIN only (Sprint-17 pgvector harness) | automated slow-query plan capture when `DB_EXPLAIN_ON_SLOW=true` | automated plan capture | `database.query.explain` log event; `sprint-26-verify.test.ts` |
| default enabled | n/a | `DB_EXPLAIN_ON_SLOW=false` | opt-in env | `db-observability-env.test.ts` 2 assertions |
| per-scope cap | n/a | max 3 EXPLAIN captures | low overhead | `sprint-26-verify.test.ts` 5 events → 3 captures |
| observability test count | 37 | 40 (+3 sprint-26 verify) | objectives covered | `npm test -w @memory-middleware/observability` |
| script test count | 4 | 4 | offline harness | `npm run perf:test-explain-slow-query` |
| env test count | 7 | 7 | opt-in flags | `db-observability-env.test.ts` |

## Places for improvement
- Add a live Postgres integration test for `npm run perf:explain-slow-query` when `DATABASE_URL` is available (closes offline-script behavioral gap).
- Add an API contract test asserting `database.ts` passes `DB_EXPLAIN_ON_SLOW` / `DB_EXPLAIN_ANALYZE` into `createInstrumentedPrismaClient` (mirrors sprint-08 source-contract pattern).
- Wire sprint-26 verify tests into CI documentation alongside observability `test` script (already included in `package.json` after verification).
