# Sprint-16 Outcomes — Lazy-Load Relationship Graph

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-14
- **Priority:** P2
- **Effort:** <1 day

## Implementation summary

Deferred the home-page relationship graph fetch out of the initial request waterfall.

### Changes

| File | Change |
|------|--------|
| `apps/dashboard/src/components/homepage/ContextualIntelligenceMap.tsx` | Added `IntersectionObserver` on the map container (`mapInView`), gated `/relationships/graph?lite=true` behind `mapInView && telemetryReady`, single-fetch guard via `graphFetchStartedRef`, and `GraphLoadingSkeleton` placeholder UI |
| `apps/dashboard/src/pages/HomePage.tsx` | Passes `telemetryReady={!loading}` so graph loads only after `useOperationalHomeData` telemetry resolves |
| `apps/dashboard/src/components/homepage/sprint-16-lazy-load-graph.test.ts` | Static verification tests for gating, IO, skeleton, and anti-objectives |

### Behavior

1. On home load, telemetry (`fetchWorkspaceTelemetry`) runs first; graph does **not** start in parallel.
2. Graph fetch begins when **both** conditions hold: map intersects viewport (IO with `rootMargin: 80px`) and `telemetryReady` is true.
3. While deferred or loading, users see an animated node-grid skeleton instead of a blank canvas.
4. `RelationshipMapPage` unchanged — still fetches full graph immediately on workspace resolve.

### Evidence

- Graph gate: `if (authLoading || !workspaceId) return` then `if (!mapInView || !telemetryReady) return` in `ContextualIntelligenceMap.tsx`
- IO defers off-viewport work; telemetry gate removes graph from telemetry critical path
- Tests: `sprint-16-lazy-load-graph.test.ts`

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not break immediate scroll to map | `IntersectionObserver` uses `rootMargin: "80px 0px"` and fires `setMapInView(true)` on first intersection; fetch runs as soon as map is visible and telemetry is ready |
| Do not lazy on pages needing graph first | Only `ContextualIntelligenceMap` (home) is lazy; `RelationshipMapPage` retains immediate `useEffect` graph fetch with no IO gate |
| No infinite fetch loops | `graphFetchStartedRef` blocks repeat fetches; ref resets only on `workspaceId` change; IO disconnects after first visibility |
| GA-1 (ranking/threshold changes) | No retrieval or graph algorithm changes — only fetch timing |
| GA-2 (non-deterministic tuning) | Deterministic boolean gates (`mapInView`, `telemetryReady`) only |
| GA-3 (trace payload breakage) | No API or trace schema changes |
| GA-4 (fabricated metrics) | No performance numbers claimed without measurement |
| GA-5 (scope creep) | Limited to home map component + `HomePage` prop wire-up |
| GA-6 (trace field removal) | No trace/dashboard contract changes |
| GA-7 (new DB tables) | Client-side deferral only |

## Verification summary

Verification agent ran `npm test` in `apps/dashboard` (12 sprint-16 tests + full suite 76 tests, all passing).

### Testing framework

| Check | Result | Evidence |
|-------|--------|----------|
| 1. Waterfall: graph after telemetry or visible | **Pass** | Fetch effect deps `[authLoading, workspaceId, mapInView, telemetryReady]`; early return when `!mapInView \|\| !telemetryReady`; `useOperationalHomeData` has no graph fetch; `HomePage` wires `telemetryReady={!loading}` |
| 2. Map renders when visible | **Pass** | IO sets `mapInView` on intersection; skeleton while `graphStatus` is `idle`/`loading`; canvas renders when nodes loaded |
| 3. No duplicate fetches | **Pass** | Single `apiGet` to `/relationships/graph?lite=true`; `graphFetchStartedRef` guard; ref reset on `workspaceId` change only |

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Graph not in critical path | **met** | Graph fetch removed from parallel home bootstrap; gated on `telemetryReady && mapInView`; telemetry hook does not call graph endpoint |
| 2 | Intersection Observer or delayed fetch | **met** | `IntersectionObserver` on `containerRef` with `rootMargin: "80px 0px"`, `threshold: 0.01`, disconnect after first intersection |
| 3 | Loading skeleton | **met** | `GraphLoadingSkeleton` with animated nodes, `aria-busy`, and "Loading relationship graph…" copy shown while deferred/loading |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not break immediate scroll to map | **no** | IO fires before map fully enters viewport (`rootMargin: 80px`); fetch starts once `mapInView && telemetryReady` |
| Do not lazy on pages needing graph first | **no** | `RelationshipMapPage.tsx` retains immediate `useEffect` graph fetch; no `IntersectionObserver` or `telemetryReady` gate |
| No infinite fetch loops | **no** | `graphFetchStartedRef` single-flight guard; IO disconnects after first visibility; workspace change resets ref |
| GA-1 | **no** | Fetch timing only; no ranking/threshold/stage-order changes |
| GA-2 | **no** | Boolean gates only; no ML or autonomous tuning |
| GA-3 | **no** | No trace payload or dashboard contract changes |
| GA-4 | **no** | Measurements table uses architectural reasoning, not fabricated runtime numbers |
| GA-5 | **no** | Scope limited to home map + `HomePage` prop |
| GA-6 | **no** | No trace field removal |
| GA-7 | **no** | Client-side deferral only |

### Regression check

Retrieval/compression pipelines and API routes unchanged. `RelationshipMapPage` still uses full `/relationships/graph` (non-lite). Home map still uses same `mapGraphFromApi` mapping and lite endpoint — only **when** the fetch runs changed.

## Verification Score
- **Score:** 95 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

### Scoring breakdown

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 100 | All three objectives verified with code + tests |
| Anti-objectives clean | 25% | 100 | Sprint-specific and GA-1–GA-7 all clean |
| Test coverage | 20% | 85 | 12 static source tests cover gates, IO, skeleton, anti-objectives; no runtime mock/RTL test for fetch ordering |
| Regression safety | 15% | 100 | Timing-only change; graph data path and dedicated map page unchanged |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| criticalPath (home parallel requests) | Graph fetch started on auth resolve in parallel with telemetry | Graph deferred until `telemetryReady && mapInView` | -1 to -2 requests | Removes 1 concurrent request from initial home waterfall; below-fold map defers graph entirely until scroll. Architectural per `DASHBOARD_LOAD_AUDIT.md` § lazy load graph. No HAR capture in CI. |
| graph fetch duplication | Single component fetch (unchanged) | Single component fetch with ref guard | no duplicates | `graphFetchStartedRef` + single `apiGet` call site |
| loading UX | Blank canvas during fetch | Animated skeleton | skeleton present | `GraphLoadingSkeleton` with `animate-pulse` nodes |

## Places for improvement

1. **Runtime waterfall test** — Mock `IntersectionObserver` and `apiGet` to assert graph fetch is not invoked until both `telemetryReady` and `mapInView` are true (similar to sprint-28's mocked `fetch` tests).
2. **HAR/benchmark capture** — Record before/after network waterfall on home load to quantify critical-path request reduction (target -1 to -2) per audit metrics.
3. **RTL smoke test** — Render `ContextualIntelligenceMap` with mocked auth/API to verify skeleton → canvas transition without relying on source-string assertions.
