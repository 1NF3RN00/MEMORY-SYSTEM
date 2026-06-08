# Sprint-38 Outcomes — EventLog DB Leaderboard Persistence

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** AR-005
- **Priority:** P2
- **Effort:** 3-5 days

## Implementation summary

Shipped cross-restart DB operation leaderboard via bounded EventLog query on `GET /diagnostics/db-operations?source=history`.

### 1. EventLog payload parsing (`packages/observability/src/database/history.ts`)
- `parseEventLogDbScopeEntry()` maps persisted `database.scope.completed` EventLog payloads to `DbOperationLeaderboardEntry`.
- `queryLeaderboardFromEventLogRows()` sorts by `totalDbTime` descending and applies `limit`, `offset`, and optional `scopeType` filter in-process.
- Exported `DB_SCOPE_COMPLETED_EVENT_TYPE` constant for shared use.

### 2. Bounded Prisma query (`apps/api/src/lib/db-operation-history.ts`)
- `queryDbOperationHistoryFromEventLog()` fetches the most recent `DB_LEADERBOARD_HISTORY_WINDOW` rows (default 1000) where `eventType = database.scope.completed`.
- Uses existing `@@index([eventType])` and `@@index([timestamp])` — no full-table scan; `take` bounds the fetch.
- Sorts by `totalDbTime` in-process after the bounded fetch.

### 3. Diagnostics route (`apps/api/src/routes/diagnostics.ts`)
- `GET /diagnostics/db-operations?source=memory` (default): unchanged in-memory ring buffer behavior.
- `GET /diagnostics/db-operations?source=history`: EventLog-backed leaderboard with `pagination` metadata (`limit`, `offset`, `windowSize`, `scannedCount`).
- Response includes `source` field and `limitations.comparison` documenting memory vs history tradeoffs.
- Invalid `source` returns 400.

### 4. Configuration (`apps/api/src/config/db-observability-env.ts`)
- Added `DB_LEADERBOARD_HISTORY_WINDOW` (default 1000) to cap EventLog fetch size.

### Evidence (objectives)
| # | Objective | Evidence |
|---|-----------|----------|
| 1 | `?source=history` on diagnostics | `diagnostics.ts` branches on `source === "history"`; contract test in `sprint-38-eventlog-db-leaderboard-persistence.test.ts` |
| 2 | Query EventLog by totalDbTime | `db-operation-history.ts` bounded `findMany` + `history.ts` sort by `totalDbTime`; fixture tests in `history.test.ts` and `db-operation-history.test.ts` |
| 3 | Document vs in-memory | Response `limitations.comparison` and `source` field for both memory and history paths |

### Test runs (2026-06-08)
| Suite | Command | Result |
|-------|---------|--------|
| Observability (incl. history) | `npm test -w @memory-middleware/observability` | **28/28 pass** |
| API db-operation-history | `node --test apps/api/dist/lib/db-operation-history.test.js` | **1/1 pass** |
| API db-observability env | `node --test apps/api/dist/config/db-observability-env.test.js` | **5/5 pass** |
| API sprint-38 contract | `node --test apps/api/dist/routes/sprint-38-eventlog-db-leaderboard-persistence.test.js` | **5/5 pass** |
| API sprint-08 regression | `node --test apps/api/dist/routes/sprint-08-db-observability-phase-four.test.js` | **5/5 pass** |
| API typecheck | `npm run build -w @memory-middleware/api` | **pass** |

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Bounded query | `take: windowSize` on EventLog fetch (default 1000 via `DB_LEADERBOARD_HISTORY_WINDOW`); `limit` clamped 1–100; optional `offset` for pagination |
| No slow scan | Query filters on indexed `eventType`, orders by indexed `timestamp desc`, bounded `take` — no JSON-path ORDER BY or full-table scan |
| No unnecessary migration | Reuses existing `event_logs` table and sprint-08 `database.scope.completed` events; no schema changes |
| GA-1 | No retrieval ranking, threshold, or stage-order changes |
| GA-2 | Deterministic sort by numeric `totalDbTime`; no ML/heuristics |
| GA-3 | Additive diagnostics fields (`source`, `pagination`, `comparison`); default memory response backward-compatible |
| GA-4 | No fabricated performance numbers; tests use fixtures only |
| GA-5 | Scope limited to history module, db-operation-history lib, diagnostics route, env config, tests |
| GA-6 | Existing trace/stages payloads untouched |
| GA-7 | No new tables; EventLog JSON payloads sufficient |

## Verification summary

Verification ran 2026-06-08. All sprint-specific and regression suites passed after a fresh API build.

### Testing framework

| Check | Result | Evidence |
|-------|--------|----------|
| Works after restart | **met** | EventLog rows are DB-persisted; `queryDbOperationHistoryFromEventLog` reads via Prisma `findMany` independent of in-memory `getDbOperationLeaderboard()` ring buffer. Memory path documents `coldStartClears: true`; history path documents `coldStartSurvives: true`. Mock fixture in `db-operation-history.test.ts` proves history query returns entries without any in-memory state. |
| Matches in-memory window | **partial** | Both sources sort leaderboard entries by `totalDbTime` descending (`leaderboard.ts`, `history.ts`). History intentionally differs: fetches the most recent `DB_LEADERBOARD_HISTORY_WINDOW` (default 1000) events by `timestamp`, then ranks in-process — not a byte-for-byte match to the in-memory ring buffer (`DB_LEADERBOARD_SIZE` default 500). `limitations.comparison` documents the tradeoff. |
| Acceptable perf | **met** | Query uses indexed `eventType` filter, `orderBy: { timestamp: "desc" }`, and bounded `take: windowSize` — no full-table scan or JSON-path ORDER BY. In-process sort/pagination on ≤1000 parsed rows is O(n log n) with fixed upper bound. |

### Test runs (verification, 2026-06-08)

| Suite | Command | Result |
|-------|---------|--------|
| Observability (incl. history) | `npm test -w @memory-middleware/observability` | **28/28 pass** |
| API db-operation-history | `node --test apps/api/dist/lib/db-operation-history.test.js` | **1/1 pass** |
| API db-observability env | `node --test apps/api/dist/config/db-observability-env.test.js` | **5/5 pass** |
| API sprint-38 contract | `node --test apps/api/dist/routes/sprint-38-eventlog-db-leaderboard-persistence.test.js` | **5/5 pass** |
| API sprint-08 regression | `node --test apps/api/dist/routes/sprint-08-db-observability-phase-four.test.js` | **5/5 pass** |
| API build | `npm run build -w @memory-middleware/api` | **pass** |
| **Total** | | **44/44 pass** |

### Regression safety

- Default `?source=memory` (or omitted `source`) path unchanged: still uses `getDbOperationLeaderboard()` with `coldStartClears` / `inMemoryOnly` limitations.
- Sprint-08 contract tests pass (5/5); no retrieval ranking, compression, or trace/stages payload changes observed in sprint scope.
- Additive response fields only for history path: `source`, `pagination`, expanded `limitations.comparison`.

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | `?source=history` on diagnostics | **met** | `diagnostics.ts` branches on `source === "history"`, calls `queryDbOperationHistoryFromEventLog`, returns `source: "history"` with pagination; invalid source returns 400. Contract test 1/5 in `sprint-38-eventlog-db-leaderboard-persistence.test.ts`. |
| 2 | Query EventLog by totalDbTime | **met** | `db-operation-history.ts` bounded `findMany` on `database.scope.completed`; `history.ts` sorts `right.totalDbTime - left.totalDbTime`. Fixture tests: `history.test.ts` (5 tests), `db-operation-history.test.ts` (1 test). |
| 3 | Document vs in-memory | **met** | Both memory and history responses include `limitations.comparison` with distinct `memory` / `history` descriptions; history adds `boundedWindow` and `coldStartSurvives`. Contract test 3/5 asserts comparison fields. |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Bounded query | **no** | `take: windowSize` (default 1000 via `DB_LEADERBOARD_HISTORY_WINDOW`); response `limit` clamped 1–100; optional `offset` pagination. Env test confirms default window. |
| No slow scan | **no** | Prisma query filters indexed `eventType`, orders by indexed `timestamp desc`, bounded `take`. No migration adding JSON indexes or full-table scan patterns. Schema `@@index([eventType])` and `@@index([timestamp])` on `event_logs` unchanged. |
| No unnecessary migration | **no** | Reuses existing `event_logs` table and sprint-08 `database.scope.completed` payloads; no Prisma schema changes in sprint diff. |
| GA-1 (retrieval determinism) | **no** | Diagnostics-only change; retrieval routes untouched. |
| GA-2 (non-deterministic tuning) | **no** | Deterministic numeric sort by `totalDbTime`. |
| GA-3 (trace payload compat) | **no** | Additive diagnostics fields; default memory response backward-compatible. |
| GA-4 (fabricated numbers) | **no** | Tests use fixtures/mocks only; no latency claims without measurement. |
| GA-5 (scope creep) | **no** | Changes limited to history module, db-operation-history lib, diagnostics route, env config, tests. |
| GA-6 (stages[] removal) | **no** | Trace/stages payloads untouched. |
| GA-7 (unnecessary tables) | **no** | EventLog JSON sufficient; no new tables. |

## Verification Score
- **Score:** 97 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

### Rubric breakdown
| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated + source-inspection evidence |
| Anti-objectives clean | 25% | 25 | Sprint and global anti-objectives verified clean |
| Test coverage | 20% | 17 | Strong unit/contract coverage; no HTTP integration or live-DB restart test |
| Regression safety | 15% | 15 | Sprint-08 regression pass; default memory path unchanged |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| observability | in-memory only; lost on cold start | cross-restart via `?source=history` | cross-restart leaderboard | EventLog-backed route; `coldStartSurvives: true` in history response; mock proves history independent of memory buffer |
| automated tests (sprint scope) | 0 sprint-38 tests | 44/44 pass across observability + API suites | objectives covered by repeatable tests | See test runs table above |
| query bound | unbounded (N/A — feature absent) | `take ≤ DB_LEADERBOARD_HISTORY_WINDOW` (default 1000) | bounded fetch | `db-operation-history.test.ts` asserts `take: 50`; env default 1000 |

## Places for improvement

1. **HTTP integration test** — Boot `create-app`, seed `event_logs` rows, assert `GET /diagnostics/db-operations?source=history` returns ranked entries (closes gap between mock Prisma and live route).
2. **Restart simulation test** — Explicit test: reset in-memory leaderboard singleton, confirm history source still returns EventLog-backed entries while memory returns empty.
3. **Query latency baseline** — Measure bounded `findMany` latency at window=1000 under realistic row counts; record in Measurements table for GA-4-grade evidence.
