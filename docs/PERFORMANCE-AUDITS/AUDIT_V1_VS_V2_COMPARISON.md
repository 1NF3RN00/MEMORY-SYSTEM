# Audit V1 vs V2 Comparison — Post-Remediation Validation

**V1 date:** 2026-06-08 (pre-remediation baseline)  
**V2 date:** 2026-06-08 (post-remediation validation)  
**Remediation program:** 7 waves, 39 sprints (`docs/performance-improvments/`)

This document is a direct comparison artifact. V2 does not assume improvements — every delta cites code, tests, or benchmark artifacts.

---

# Headline Verdict

| Question | Answer |
|----------|--------|
| Materially better than V1? | **Yes** for observability, dashboard efficiency, stability, maintainability, and DX |
| Retrieval faster? | **No** — now measured at **8,969 ms p50** (V1 mock: 29 ms) |
| Ready for customer demo? | **Beta** — strong ops/NOC story; weak latency middleware story |

**Net score change: +13 overall health (71 → 84)**

---

# Score Comparison

| Category | V1 | V2 | Δ | Direction |
|----------|----|----|---|-----------|
| System Health | 71 | 87 | **+16** | Improved |
| Performance | 59 | 72 | **+13** | Improved (dashboard; not retrieval) |
| Stability | 64 | 82 | **+18** | Improved |
| Maintainability | 62 | 81 | **+19** | Improved |
| Developer Experience | 74 | 88 | **+14** | Improved |
| Observability | 48 | 89 | **+41** | Improved |
| **Overall Health** | **71** | **84** | **+13** | **Improved** |

---

# Finding Resolution Matrix

## Confirmed bugs (V1 → V2)

| ID | V1 finding | V2 status | Evidence |
|----|------------|-----------|----------|
| BUG-001 | N+1 on `/diagnostics/operational` | **Fixed** | sprint-03 batch `findMany` |
| BUG-002 | Full graph downloaded, ~24 nodes shown | **Fixed** | sprint-04 `?lite=true` + sprint-16 lazy load |
| BUG-003 | Duplicate home API calls | **Fixed** | sprints 01, 02, 28 |

## Probable bugs (V1 → V2)

| ID | V1 finding | V2 status | Evidence |
|----|------------|-----------|----------|
| PBUG-001 | Context package race | **Fixed** | sprint-29 two-phase completion |
| PBUG-002 | LLM calls invisible without ALS | **Fixed** | sprint-09 100% route inventory |
| PBUG-003 | Compression vs retrieval trace ID UX | **Mitigated** | sprint-30 structured errors |

## Major findings (V1 → V2)

| ID | V1 finding | V2 outcome |
|----|------------|------------|
| MF-001 | Vector search dominates (mock) | **Still true in absolute terms** but mock proportions misleading; prod interior gap dominates |
| MF-002 | Dashboard over-fetches | **Substantially addressed** — measured 11 req / 14 KB empty; bootstrap path 2–3 req (unit test) |
| MF-003 | DB observability not implemented | **Resolved** — instrumented Prisma + `dbObservability` |
| MF-004 | LLM cost low; embedding count high | **Unchanged** — still low cost; embedding RTT confirmed costly in prod |
| MF-005 | Observability sprint half-complete | **Resolved** — timing + LLM + DB + unified UI |
| MF-006 | No production percentiles | **Partially resolved** — retrieval captured; dashboard partial; Profiler missing |

---

# Metric-by-Metric Comparison

## Dashboard

| Metric | V1 | V2 | Δ | Verified? |
|--------|----|----|---|-----------|
| Home request count | 14–16 (inferred) | **11** measured; **2–3** bootstrap (test) | **−22% to −80%** | Partial |
| Home JSON (empty) | 5–30 KB (inferred) | **14.0 KB** | Measured | Yes |
| Home JSON (moderate) | 300–1,500 KB (inferred) | Not re-measured | — | **No** |
| Home e2e p50 | Unknown | **2,513 ms** | Baseline only | Yes |
| Duplicate `/health` | 2× | **1×** | −50% | Yes |
| Duplicate `/workspaces/default` | 2× | **0×** on home | −100% | Yes |
| Poll interval | 15 s full bundle | **15 s** summary; **60 s** if SSE connected | Reduced when stream up | Yes |
| Caching layer | None | React Query + in-flight dedupe | New | Yes |
| Compression home payload | Multi-MB full trace | **<2 KB** summary | **>99%** on fixture | Yes |
| Operational diagnostics (100 traces) | ~3.2 KB full | **190 B** slim | **−94.1%** | Yes |
| Lite graph (fixture) | 2,120 B | **1,037 B** | **−51.1%** | Yes |

## Retrieval

| Metric | V1 | V2 | Δ | Verified? |
|--------|----|----|---|-----------|
| Request total p50 | 29.35 ms (mock) | **8,968.67 ms** (prod-local) | **+30,558%** | Yes (not improved) |
| Request total p95 | Unknown | **10,407.39 ms** | Baseline | Yes |
| Request total p99 | Unknown | **11,026.14 ms** | Baseline | Yes |
| Retrieval umbrella p50 | 27.54 ms (mock) | **7,549.99 ms** | **+27,300%** | Yes |
| `vector_search:embedding` mean | 7.29 ms | **521.79 ms** | **+7,057%** | Yes |
| `vector_search:pgvector` mean | 15.03 ms | **120.39 ms** | **+701%** | Yes |
| Instrumented stage share | 81% (mock) | **~8.4%** (prod mean) | Gap exposed | Yes |
| Uninstrumented interior (derived) | Unknown | **~6,893 ms (90%)** | **New V2 finding** | Derived |
| Embedding cache | None | LRU/TTL shipped | Repeat-query benefit | **Hit-rate unverified** |
| BM25 V2 | None | Flag off by default | No prod effect | Yes |

## Database

| Metric | V1 | V2 | Δ | Verified? |
|--------|----|----|---|-----------|
| Prisma instrumentation | None | **$extends` hook** | Shipped | Yes |
| `dbObservability` on retrieve | Missing | **Present** | Shipped | Yes |
| Query count visibility | No | **Yes** | Shipped | Yes |
| Slow query detection | No | **Yes** | Shipped | Yes |
| Duplicate/N+1 detection | No | **Yes** | Shipped | Yes |
| N+1 operational diagnostics | Confirmed | **Eliminated** | Fixed | Yes |
| DB leaderboard persistence | In-memory only (planned) | **EventLog history** | Shipped | Yes |
| Live DB time in 9s retrieval | N/A | **Not in benchmark artifact** | Gap | **No** |

## Observability & instrumentation

| Capability | V1 | V2 |
|------------|----|----|
| Execution timing on retrieve/plan | Yes | **Yes + compress, context, ingestion, worker** |
| LLM audit coverage | Partial | **Full HTTP inventory** |
| DB observability | Plan only | **Phases 1–4 + persistence** |
| Production retrieval benchmark | No | **50-sample artifact** |
| Dashboard load benchmark | No | **HTTP mirror artifact** |
| pgvector EXPLAIN | No | **3 variants captured** |
| Unified trace UI (timing+LLM+DB) | No | **TraceObservabilityPanel** |
| EXPLAIN on slow query automation | No | **Opt-in Prisma hook** |
| SSE operational stream | No | **SSE + poll backoff** |

---

# Latency Comparison Tables

## Retrieval percentiles

| Statistic | V1 | V2 | Change |
|-----------|----|----|--------|
| Average | 29.35 ms (mock) | **9,109.98 ms** | Not improved |
| p50 | 29.35 ms | **8,968.67 ms** | Not improved |
| p95 | — | **10,407.39 ms** | Baseline established |
| p99 | — | **11,026.14 ms** | Baseline established |
| Worst case | — | **11,093.04 ms** | Baseline established |

## Retrieval stages (mean)

| Stage | V1 (mock) | V2 (prod-local) | % of retrieval V2 |
|-------|-----------|-----------------|-------------------|
| `retrieval` umbrella | 27.54 ms | **7,656.55 ms** | 100% |
| `vector_search:embedding` | 7.29 ms | **521.79 ms** | 6.8% |
| `vector_search:pgvector` | 15.03 ms | **120.39 ms** | 1.6% |
| Uninstrumented gap (derived) | — | **~6,893 ms** | **90.0%** |
| `reranking` | 0.25 ms | **0.02 ms** | <0.01% |

## Dashboard home (empty workspace)

| Statistic | V1 | V2 | Change |
|-----------|----|----|--------|
| Request count | 14–16 (inferred) | **11** measured | Improved (partial) |
| Total JSON | 5–30 KB (inferred) | **14.0 KB** | Measured |
| e2e p50 | — | **2,513 ms** | Baseline |
| e2e p95 | — | **3,640 ms** | Baseline |

---

# Top-25 Opportunity Completion (V1 roadmap)

| V1 rank | Opportunity | V2 status |
|---------|-------------|-----------|
| 1 | apiGet dedupe | ✅ Implemented |
| 2 | Workspace ID in AuthContext | ✅ Implemented |
| 3 | Fix operational N+1 | ✅ Implemented |
| 4 | Lite graph | ✅ Implemented |
| 5 | Compression metadata | ✅ Implemented |
| 6 | Remove home ranking follow-up | ✅ Implemented |
| 7 | DB observability Phases 1–3 | ✅ Implemented (+ Phase 4) |
| 8 | Telemetry tier split | ✅ Implemented |
| 9 | React.memo home panels | ✅ Implemented |
| 10 | Remove Framer layout | ✅ Implemented |
| 11 | Dashboard bootstrap | ✅ Implemented |
| 12 | WorkspaceTelemetryProvider | ✅ Implemented |
| 13 | React Query | ✅ Implemented |
| 14 | Lazy-load graph | ✅ Implemented |
| 15 | LLM audit all routes | ✅ Implemented |
| 16 | pgvector EXPLAIN | ⚠️ Partial (empty workspace) |
| 17 | Embedding cache | ✅ Implemented (hit-rate unmeasured) |
| 18 | Ref-based timers | ✅ Implemented |
| 19 | Single panel instance | ✅ Implemented |
| 20 | gzip/brotli API | ✅ Implemented |
| 21 | List field projection | ❌ Not started (sprint-22) |
| 22 | Ingestion timing | ✅ Implemented |
| 23 | Dashboard timing display | ✅ Implemented |
| 24 | WebSocket/SSE push | ⚠️ Partial (SSE; poll fallback) |
| 25 | EXPLAIN automation | ✅ Implemented |

**Completion: 22 implemented, 3 partial, 1 not started**

---

# What Improved (evidence-backed)

1. **Observability (+41)** — DB instrumentation, production baselines, unified trace pane, worker scopes, EventLog persistence.
2. **Stability (+18)** — N+1 eliminated, context-package race fixed, LLM coverage complete.
3. **Maintainability (+19)** — Telemetry tiers, bootstrap, React Query, shared provider, timing patterns extended.
4. **Dashboard efficiency** — Request count down (measured 11, target 2–3 with bootstrap); payloads slimmed (diagnostics −94%, compression >99% on fixture, lite graph −51%).
5. **Developer experience (+14)** — Repeatable `perf:bench-retrieval`, `perf:bench-dashboard-load`, `perf:bench-pgvector-explain`.

---

# What Did Not Improve

1. **`POST /retrieve` latency** — p50 **8,969 ms**; remediation did not target retrieval speed.
2. **Moderate/heavy dashboard loads** — no post-bootstrap benchmark with populated workspace.
3. **List endpoint payload bloat** — `/retrieval?limit=50` still **13.5 KB** on empty workspace (93% of home bytes); sprint-22 not started.
4. **React Profiler validation** — poll-driven re-render reduction claimed via memo/SSE but not profiler-measured.
5. **pgvector under real data** — HNSW not exercised in EXPLAIN (0 embedded chunks).

---

# Regressions & New Risks

| Item | Type | Severity |
|------|------|----------|
| 39-sprint surface area | Complexity | Low |
| V1 mock baseline masked 9s real latency | Visibility (not regression) | Info |
| Retrieval interior 90% uninstrumented | New bottleneck discovery | **Critical** |
| Dashboard benchmark staleness (pre-bootstrap) | Measurement gap | Medium |
| BM25 V2 branch when enabled | Complexity | Low |

---

# Quality Tier Shift

| Tier | V1 | V2 |
|------|----|----|
| Prototype | Partially | Exceeded |
| **Beta** | Approaching | **Current** |
| Production | No | No — retrieval SLO missing |
| Enterprise | No | No — no multi-tenant load proof |

---

# Recommended Next Measurements (close V2 gaps)

1. Re-run `perf:bench-dashboard-load` with bootstrap path + populated workspace.
2. Re-run `perf:bench-retrieval` capturing `dbObservability` per sample.
3. React Profiler 30s capture on home (post-memo, post-SSE).
4. pgvector EXPLAIN after workspace has embedded chunks.
5. Embedding cache A/B: identical query repeat in benchmark harness.

---

# File Index

| Document | Purpose |
|----------|---------|
| `SYSTEM_PERFORMANCE_AUDIT_V1.md` | Pre-remediation baseline |
| `PERFORMANCE_FINDINGS.json` | V1 machine-readable findings |
| `SYSTEM_PERFORMANCE_AUDIT_V2.md` | Post-remediation validation report |
| `PERFORMANCE_FINDINGS_V2.json` | V2 machine-readable findings |
| `AUDIT_V1_VS_V2_COMPARISON.md` | This comparison |

---

*Generated as part of PERFORMANCE-AUDIT validation sprint — evidence over assumptions.*
