# Sprint-31 Outcomes — Production Retrieval Latency Baseline

## Status
- **Implementation:** complete (code + artifacts; ledger updated by verification)
- **Verification:** complete

## Audit mapping
- **IDs:** MF-006, LAT-009
- **Priority:** P0
- **Effort:** 3-5 days

## Implementation summary

Shipped a repeatable POST `/retrieve` latency benchmark harness and captured a first real-environment baseline (local API with live OpenAI + pgvector).

**Deliverables:**
- `scripts/benchmark-retrieval.ts` — HTTP benchmark runner with fixed query set, warmup, percentile aggregation, per-stage aggregates, mock-baseline comparison, JSON artifact output, and production-host guard.
- `scripts/benchmark-retrieval.test.ts` — unit tests for percentile math, summarization, and stage aggregation.
- `package.json` — `npm run perf:bench-retrieval` script entry.
- `docs/performance-improvments/sprint-31-production-retrieval-baseline/runs/benchmark-implement.json` — 50-sample run artifact (2026-06-08T19:52:45Z).
- `docs/performance-improvments/sprint-31-production-retrieval-baseline/runs/benchmark-2026-06-08T18-56-47-940Z.json` — corroborating 50-sample run (2026-06-08T18:56:47Z).

**Run configuration (fixed for both artifacts):**
| Setting | Value |
|---------|-------|
| API | `http://localhost:3000` (`hostClass: local`) |
| Workspace | `01KT7D64WDCDGTHEYK93KEXAPH` |
| `retrievalMode` | `precision` |
| `tokenBudget` | `2000` |
| Samples | 50 (+ 2 warmup) |
| Query set | 5 fixed queries (`FIXED_BENCHMARK_QUERIES`) |
| OpenAI / Supabase | configured (`openaiConfigured: true`, `supabaseConfigured: true`) |

**Note:** Implementation agent did not pre-fill this ledger; verification reconstructed claims from code and run artifacts.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| No fabricated numbers | All percentiles derived from 50 real HTTP responses with `timingAudit` payloads and ULID `retrievalTraceId` per sample; mock 27.54ms referenced only as comparison baseline, not reported as measured latency. |
| No prod without approval | `assertHostAllowed()` blocks `*.vercel.app` / `memory-system-api.vercel.app` unless `BENCHMARK_ALLOW_PROD=true`; manual verification confirmed refusal message. |
| Fixed config during run | `environment` block records API URL, mode, token budget, query set, and sample count in each JSON artifact. |
| GA-1 | Benchmark is read-only measurement; no retrieval ranking, thresholds, or stage ordering changed by sprint deliverables. |
| GA-2 | No agents, ML heuristics, or non-deterministic tuning added. |
| GA-3 | Consumes existing `timingAudit` / `retrievalTraceId` response fields; does not modify trace payloads. |
| GA-4 | Latency numbers sourced from run artifacts, not invented; large local-vs-mock deltas explicitly documented. |
| GA-5 | Scope limited to `scripts/benchmark-retrieval*`, `package.json` script, and `runs/` artifacts. |
| GA-6 | No `stages[]` or trace fields removed. |
| GA-7 | No new database tables; benchmark uses existing HTTP API. |

## Verification summary

Verification ran the helper test suite, manually exercised the production-host guard, inspected benchmark artifacts, and confirmed the harness is repeatable via `npm run perf:bench-retrieval`.

**Test command:** `npx tsx --test scripts/benchmark-retrieval.test.ts`

**Result:** 4/4 passed (2026-06-08).

**Production guard check:** `runBenchmark({ apiUrl: 'https://memory-system-api.vercel.app' })` without `BENCHMARK_ALLOW_PROD` → `Refusing production host memory-system-api.vercel.app...`

**Live rerun:** Local API was unreachable during verification (`http://localhost:3000/health` → UNREACHABLE). Evidence relies on same-day implementation artifacts (50/50 success, 0 failures).

**Testing framework:**
1. **Repeatable script** — `npm run perf:bench-retrieval` with CLI/env knobs (`--samples`, `--output`, `BENCHMARK_*`).
2. **Results in outcomes** — percentiles and stage aggregates recorded below (from `benchmark-implement.json`).
3. **JSON artifact** — timestamped runs under `runs/` with full per-sample `timingAudit` for audit replay.

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Benchmark script | **met** | `scripts/benchmark-retrieval.ts`; `npm run perf:bench-retrieval` in root `package.json` |
| 2 | Percentiles in outcomes | **met** | Measurements table below (p50/p95/p99 for `timingAudit.totalLatency` and retrieval stage) |
| 3 | Stage aggregates | **met** | `stageAggregates[]` in artifact; top stages: `retrieval`, `vector_search:embedding`, `vector_search:pgvector` |
| 4 | Compare to mock 27.54ms | **met** | `comparisonToMock.retrievalStageVsMockRetrieval`: p50 **274.15×** (+7522.45ms), p95 **308.79×** (+8476.43ms) vs mock 27.54ms |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| No fabricated numbers | **no** | 50 samples with per-request `timingAudit`, `retrievalTraceId`, and wall-clock timings in JSON artifact |
| No prod without approval | **no** | Guard blocks vercel production host without `BENCHMARK_ALLOW_PROD=true` (manual check) |
| Fixed config during run | **no** | Identical `retrievalMode`, `tokenBudget`, `querySet`, and sample count across both artifacts |
| GA-1 (retrieval determinism) | **no** | Measurement-only sprint deliverables |
| GA-2 (non-deterministic tuning) | **no** | No algorithm changes in benchmark code |
| GA-3 (trace payload compat) | **no** | Reads existing response fields only |
| GA-4 (fabricated numbers) | **no** | Numbers traceable to JSON artifacts |
| GA-5 (scope creep) | **no** | Confined to scripts + npm script + runs |
| GA-6 (trace field removal) | **no** | No trace schema changes |
| GA-7 (new DB tables) | **no** | HTTP-only benchmark |

### Regression
Retrieval/compression outputs unchanged — sprint added measurement tooling only; no pipeline or route logic modified by sprint-31 files.

## Verification Score
- **Score:** 92 / 100
- **Objectives met:** 4 / 4
- **Anti-objectives violated:** none

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 100 | Script, percentiles, stage aggregates, and mock comparison all evidenced |
| Anti-objectives clean | 25% | 100 | Sprint + GA-1–GA-7 clean |
| Test coverage | 20% | 70 | Helper unit tests solid; no automated prod-guard test; no CI hook; live rerun blocked (API down) |
| Regression safety | 15% | 100 | Read-only measurement; no retrieval algorithm changes |

## Measurements

Primary evidence: `runs/benchmark-implement.json` (50 samples, 0 failures, 2026-06-08).

| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| `timingAudit.totalLatency` p50 (ms) | — (mock avg 29.35) | **8968.67** | real p50 for retrieve | artifact `totals.timingAuditTotalLatency.p50` |
| `timingAudit.totalLatency` p95 (ms) | — | **10407.39** | real p95 for retrieve | artifact `totals.timingAuditTotalLatency.p95` |
| `timingAudit.totalLatency` p99 (ms) | — | **11026.14** | real p99 for retrieve | artifact `totals.timingAuditTotalLatency.p99` |
| `retrieval` stage p50 (ms) | 27.54 (mock LAT-003) | **7549.99** | real p50 retrieval stage | artifact `totals.retrievalStage.p50` |
| `retrieval` stage p95 (ms) | — | **8503.97** | real p95 for retrieve | artifact `totals.retrievalStage.p95` |
| `retrieval` stage p99 (ms) | — | **9190.04** | — | artifact `totals.retrievalStage.p99` |
| vs mock retrieval p95 ratio | 1.0× | **308.79×** | compare to 27.54ms | `comparisonToMock.retrievalStageVsMockRetrieval.p95Ratio` |
| `vector_search:embedding` mean (ms) | 7.29 (mock) | **521.79** | LAT-009 production embedding signal | `stageAggregates` (6.8% of retrieval mean) |
| `vector_search:pgvector` mean (ms) | 15.03 (mock) | **120.39** | — | `stageAggregates` (1.6% of retrieval mean) |
| sample success rate | — | **50/50** | 50+ samples | `failures: 0`, all `httpStatus: 200` |
| automated helper tests | — | **4/4 pass** | repeatable framework | `npx tsx --test scripts/benchmark-retrieval.test.ts` |

**Interpretation:** Local dev with real OpenAI embedding RTT dominates latency (~7× mock embedding avg; retrieval p95 ~309× mock umbrella). This closes MF-006 (no production percentiles) for a **local/staging-like** environment; dedicated remote staging host not yet exercised.

## Places for improvement
- Run benchmark against an explicit **staging** API URL (`BENCHMARK_API_URL`) to match implement.md scope wording; current evidence is `hostClass: local`.
- Add automated test for `assertHostAllowed` / production host classification (currently manual only).
- Register `perf:bench-retrieval:test` (or root `npm test`) so CI can run helper tests without ad-hoc `npx tsx --test`.
- Pin a slim “verification rerun” command in sprint docs (e.g. `--samples 10`) for faster guard-rail checks when API is up.
- Implementation sprint should pre-fill `outcomes.md` before handoff to reduce verification reconstruction work.
