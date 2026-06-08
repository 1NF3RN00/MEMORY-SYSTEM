# Sprint-32 Outcomes — Dashboard Load Measurement Harness

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** FE-002, DASHBOARD_LOAD_AUDIT
- **Priority:** P0
- **Effort:** 3-5 days

## Implementation summary

Shipped a repeatable dashboard home-load measurement harness with HTTP API mirror (primary), optional Playwright HAR capture, React Profiler checklist, and a captured local baseline.

**Deliverables:**

| Artifact | Path |
|----------|------|
| Procedure doc | `docs/testing/dashboard-load-benchmark.md` |
| HTTP benchmark script | `scripts/benchmark-dashboard-load.ts` |
| HAR capture + sanitization | `scripts/benchmark-dashboard-har.ts`, `scripts/benchmark-dashboard-har-sanitize.ts` |
| Unit tests | `scripts/benchmark-dashboard-load.test.ts` |
| npm scripts | `perf:bench-dashboard-load`, `perf:bench-dashboard-har` |
| Baseline artifact | `runs/dashboard-load-baseline-implement.json` |
| HAR summary (unauthenticated redirect) | `runs/dashboard-har-2026-06-08T20-05-27-903Z.json` |

**Baseline run (2026-06-08, local API):**

| Setting | Value |
|---------|-------|
| API | `http://localhost:3000` (`hostClass: local`) |
| Workspace | `01KT7D64WDCDGTHEYK93KEXAPH` |
| Auth | Ephemeral `x-api-key` (not committed) |
| Samples | 3 full home-load cycles |
| Mode | `http_api_mirror` |

**Measured home load (HTTP mirror):**

| Metric | Value |
|--------|-------|
| Request count (mean / p50) | **11 / 11** |
| JSON payload (mean / p50) | **14.0 KB / 14.0 KB** |
| Payload tier | **empty** (within audit 5–30 KB range) |
| End-to-end latency p50 / p95 | **2513 ms / 3640 ms** |
| Top endpoint by bytes | `/retrieval?limit=50` (~13 KB per cycle) |

Request count **11** is below the audit's pre-optimization 12–16 range, consistent with Wave 1 quick wins (dedupe, removed duplicate `/health`, no home `/ranking` follow-up, lite graph, slim diagnostics).

**Playwright HAR:** Script runs; capture against `localhost:5173` recorded **0 API entries** because Supabase auth redirected to `/access` (no session in headless browser). Sanitized HAR artifact written; use logged-in storage state or no-Supabase local dev for full browser baseline.

**Tests:** `npx tsx --test scripts/benchmark-dashboard-load.test.ts` → **6/6 passed**.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No secrets in HAR | `sanitizeHar()` redacts `Authorization`, `Cookie`, `x-api-key`, post bodies, and sensitive query params; raw HAR deleted by default |
| Note StrictMode vs prod | Documented in `dashboard-load-benchmark.md`, `AUDIT_REFERENCE.strictModeNote`, and benchmark JSON artifacts |
| No fabricated data | All numbers from live HTTP samples (3 cycles) and Playwright run; baseline JSON in `runs/` |
| GA-1 | Measurement-only; no retrieval ranking, thresholds, or stage ordering changed |
| GA-2 | No agents, ML heuristics, or non-deterministic tuning |
| GA-3 | Read-only API calls; no trace payload schema changes |
| GA-4 | Payload/request counts traceable to `runs/dashboard-load-baseline-implement.json` |
| GA-5 | Scope limited to scripts, docs, npm scripts, and sprint `runs/` artifacts |
| GA-6 | No `stages[]` or trace fields removed |
| GA-7 | No new database tables |

## Verification summary

Verification agent re-ran the harness and automated tests on 2026-06-08 against a live local API (`GET /health` → 200).

### Testing framework

| Check | Result | Evidence |
|-------|--------|----------|
| Reproducible by second engineer | **Yes** | `docs/testing/dashboard-load-benchmark.md` documents prerequisites, env vars, npm commands, and `_provision-benchmark-key.ts` for auth |
| Before/after template | **Yes** | Template table in `dashboard-load-benchmark.md` § Before / after template |
| Recorded in outcomes.md | **Yes** | Measurements table below |
| Automated helper tests | **Yes** | `npx tsx --test scripts/benchmark-dashboard-load.test.ts` → **6/6 pass** (verification run) |
| Independent baseline reproduction | **Yes** | `runs/dashboard-load-baseline-verify.json` (3 cycles, ephemeral key, not committed) |

**Verification benchmark run:** Provisioned ephemeral `x-api-key` via `_provision-benchmark-key.ts`, set `BENCHMARK_WORKSPACE_ID`, ran `npx tsx scripts/benchmark-dashboard-load.ts --samples 3`. Results align with implement baseline (request count 10–11, payload ~14 KB, `/retrieval?limit=50` dominates bytes).

**Path alignment:** `buildTelemetryPaths()` mirrors all nine parallel calls in `fetchWorkspaceTelemetry()` plus `/health`; benchmark adds auth bootstrap and lite graph — confirmed by unit test and side-by-side code review.

**HAR security audit:** Grep of sprint `runs/` for `Bearer`, `x-api-key`, `password`, `secret` → no matches. Sanitized HAR contains only public navigation headers; redaction covered by unit test.

**Regression:** Sprint is measurement-only (scripts + docs). No changes to retrieval/compression pipeline outputs or dashboard telemetry logic.

### Objective results

| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Documented procedure | **Met** | `docs/testing/dashboard-load-benchmark.md` — quick start, env vars, StrictMode note, DevTools checklist, Profiler checklist, before/after template |
| 2 | Baseline captured | **Met** | `runs/dashboard-load-baseline-implement.json`; independently reproduced in `runs/dashboard-load-baseline-verify.json` |
| 3 | Optional Playwright HAR | **Met** | `scripts/benchmark-dashboard-har.ts` + sanitizer; summary artifact `runs/dashboard-har-2026-06-08T20-05-27-903Z.json`; 0 API entries documented due to auth redirect (expected for unauthenticated headless run) |

### Anti-objective results

| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No secrets in HAR | **No** | Sanitized HAR has no auth headers; grep clean; `sanitizeHar` unit test passes |
| Note StrictMode vs prod | **No** | Documented in procedure doc, `AUDIT_REFERENCE.strictModeNote`, HAR summary `strictModeWarning` |
| No fabricated data | **No** | Verify run produced live JSON artifact; metrics within ~1% of implement baseline on payload, ±1 request on count |
| GA-1 through GA-7 | **No** | Measurement-only sprint; no ranking/algorithm/trace/schema/DB changes |

## Verification Score
- **Score:** 97 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown:**

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with artifacts and independent reproduction |
| Anti-objectives clean | 25% | 25 | No violations; HAR sanitization verified |
| Test coverage | 20% | 17 | Helper/sanitizer unit tests solid; no npm script for tests; Playwright HAR not validated with authenticated session |
| Regression safety | 15% | 15 | Read-only measurement; no product behavior changes |

## Measurements

| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Home request count (HTTP mirror) | — (audit est. 12–16) | **11** implement / **10.3** verify mean | measured dashboard load | `runs/dashboard-load-baseline-implement.json`, `runs/dashboard-load-baseline-verify.json` |
| Home JSON payload (KB) | — (audit est. 300–1500 moderate) | **14.0** implement / **13.9** verify mean | measured dashboard load | `aggregates.totalResponseKb.mean` in both artifacts |
| End-to-end home load p50 (ms) | — | **2513** implement / **1901** verify | measured dashboard load | `aggregates.endToEndMs.p50` (verify faster; same workspace, different auth path) |
| Top endpoint by bytes | — | `/retrieval?limit=50` | measured dashboard load | `endpointAggregates[0]` in both artifacts |
| Automated helper tests | — | **6/6 pass** | repeatable framework | verification run 2026-06-08 |
| Playwright HAR (optional) | — | script + sanitizer; 0 API entries (auth redirect) | optional HAR | `runs/dashboard-har-2026-06-08T20-05-27-903Z.json` |
| Measurement mode | — | `http_api_mirror` (local API) | documented | `measurementMode` + `environment.hostClass` in JSON artifacts |

## Places for improvement

1. **Playwright auth fixture** — Add documented storage-state or Supabase-bypass setup so optional HAR captures prod-like Fetch/XHR counts (currently 0 API entries on unauthenticated dev).
2. **npm test script** — Wire `scripts/benchmark-dashboard-load.test.ts` into root `package.json` (e.g. `test:bench-dashboard`) for CI discoverability.
3. **401 fail-fast hint** — When `/workspaces/default` returns 401, print the `_provision-benchmark-key.ts` one-liner in the error message (verification hit this before provisioning a key).
