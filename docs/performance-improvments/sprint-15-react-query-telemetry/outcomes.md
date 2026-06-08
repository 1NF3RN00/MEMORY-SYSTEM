# Sprint-15 Outcomes — React Query for Telemetry

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-13, FE-003
- **Priority:** P1
- **Effort:** 1 week

## Implementation summary

Migrated `WorkspaceTelemetryProvider` from manual `useState` + `setInterval` polling to TanStack React Query (`@tanstack/react-query` v5).

### Changes shipped

| Area | File | What changed |
|------|------|--------------|
| Dependency | `apps/dashboard/package.json` | Added `@tanstack/react-query` |
| Query client | `apps/dashboard/src/lib/queryClient.ts` | Shared `QueryClient` with `structuralSharing: true`, `refetchOnWindowFocus: false` |
| Query keys | `apps/dashboard/src/lib/telemetryQueryKeys.ts` | Documented `telemetry.summary` / `telemetry.analytics` keys; `TELEMETRY_STALE_TIME_MS = TELEMETRY_POLL_INTERVAL_MS` (15s) |
| App shell | `apps/dashboard/src/main.tsx` | `QueryClientProvider` wraps router/auth (telemetry-only scope) |
| Provider | `apps/dashboard/src/context/WorkspaceTelemetryContext.tsx` | Summary `useQuery` with `staleTime` + `refetchInterval`; analytics `useQuery` enabled on `requestAnalytics`; errors surfaced via `summaryError` / `analyticsError` |
| Tests | `apps/dashboard/src/context/sprint-15-react-query-telemetry.test.ts` | Sprint verification harness (13 tests) |

### Objectives — implementation evidence

1. **Cached telemetry with staleTime** — Both summary and analytics queries set `staleTime: TELEMETRY_STALE_TIME_MS` (15_000 ms), aligned with poll cadence.
2. **Structural sharing reduces re-renders** — `structuralSharing: true` on query client defaults and per-query options; unchanged poll payloads retain referential identity.
3. **StrictMode no double network** — `QueryClientProvider` inside `StrictMode`; `staleTime` equals poll interval so remounts reuse cached/in-flight data instead of re-fetching.

### Behavioral preservation

- Summary tier still loads via `fetchTelemetrySummary` (bootstrap-backed).
- Analytics tier still deferred until `requestAnalytics()` (Observability route / panel expand).
- 15s poll cadence preserved via `refetchInterval: TELEMETRY_POLL_INTERVAL_MS`.
- `mms:data-cleared` invalidates telemetry queries and resets analytics request state.
- Slice hooks (`useTelemetryIndicators`, etc.) unchanged in API; added optional `error` on summary-tier hooks.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not migrate entire dashboard | Only `WorkspaceTelemetryProvider` uses `useQuery`; `HomePage`, `AuthContext`, and other routes unchanged |
| Document query keys | `telemetryQueryKeys.ts` table documents summary/analytics keys and invalidation prefix |
| Surface errors | `summaryError`, `analyticsError` on context; `error` on slice hooks; queryFns throw when fetch returns null |
| GA-1 (ranking/retrieval changes) | No retrieval pipeline or ranking logic touched |
| GA-2 (non-deterministic tuning) | No ML/heuristics; deterministic fetch functions unchanged |
| GA-3 (trace payload breaks) | Telemetry DTO shape unchanged; same `WorkspaceTelemetry` type |
| GA-4 (fabricated numbers) | No performance measurements claimed without test evidence |
| GA-5 (scope creep) | Limited to dashboard telemetry layer + sprint test harness |
| GA-6 (trace field removal) | No `stages[]` or trace fields modified |
| GA-7 (new DB tables) | Client-side cache only; no persistence layer added |

## Verification summary

Verification agent extended the sprint-15 harness with **runtime React Query tests** (staleTime dedupe + structural-sharing referential identity) and ran regression suites for Sprint-14 and Sprint-28.

### Test runs (2026-06-08)

```text
npm test -- src/context/sprint-15-react-query-telemetry.test.ts
  → 13 passed

npm test -- src/context/sprint-14-workspace-telemetry-provider.test.ts \
           src/components/homepage/sprint-28-consolidated-health-polling.test.ts
  → 25 passed (regression)
```

### Testing framework checklist

| Check | Result | Evidence |
|-------|--------|----------|
| StrictMode single wire per key | met (analogue) | Runtime `fetchQuery` ×2 within `staleTime` → `queryFn` called once; `staleTime === poll interval` + `QueryClientProvider` inside `StrictMode` in `main.tsx` |
| refetchInterval for poll | met | Source asserts `refetchInterval: TELEMETRY_POLL_INTERVAL_MS`; `setInterval` removed from provider |
| Error states visible | met (provider API) | `summaryError` / `analyticsError` on context; `error` on slice hooks; `telemetryErrorMessage` helper |

### Objective results

| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Cached telemetry with staleTime | **met** | `telemetryQueryKeys.ts` exports `TELEMETRY_STALE_TIME_MS = 15_000`; both `useQuery` blocks set `staleTime`; runtime test confirms second `fetchQuery` does not re-wire within stale window |
| 2 | Structural sharing reduces re-renders | **met** | `queryClient.ts` + per-query `structuralSharing: true`; runtime test confirms unchanged nested payload keeps referential identity after shallow-copy update |
| 3 | StrictMode no double network | **met** | `main.tsx` nests `QueryClientProvider` under `StrictMode`; `TELEMETRY_STALE_TIME_MS === TELEMETRY_POLL_INTERVAL_MS`; runtime staleTime dedupe test models remount reuse |

### Anti-objective results

| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not migrate entire dashboard | **no** | `useQuery` only in `WorkspaceTelemetryContext.tsx`; `HomePage.tsx` and `AuthContext.tsx` have no `useQuery` (static grep + sprint test) |
| Document query keys | **no** | `telemetryQueryKeys.ts` JSDoc table + typed key factories |
| Surface errors | **no** | Provider exposes `summaryError` / `analyticsError`; slice hooks return `error`; failed fetches throw in `queryFn` |
| GA-1 | **no** | No retrieval/ranking code touched |
| GA-2 | **no** | No ML or non-deterministic tuning |
| GA-3 | **no** | `WorkspaceTelemetry` DTO unchanged; Sprint-14/28 regression tests pass |
| GA-4 | **no** | Measurements cite test output only |
| GA-5 | **no** | Scope limited to telemetry + test harness |
| GA-6 | **no** | No trace field removals |
| GA-7 | **no** | Client-side cache only |

### Regression

Retrieval and compression pipelines unchanged. Sprint-14 (shared provider) and Sprint-28 (consolidated health polling) regression suites pass (38 total tests across three files).

## Verification Score

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | 3/3 with code + runtime test evidence |
| Anti-objectives clean | 25% | 25 | None violated |
| Test coverage | 20% | 18 | 13 sprint tests + 25 regression; no jsdom StrictMode mount harness |
| Regression safety | 15% | 15 | Prior sprint tests green; no backend changes |

- **Score:** 98 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

## Measurements

| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Poll mechanism | `setInterval` in provider | `refetchInterval: 15_000` via React Query | 15s poll preserved | `WorkspaceTelemetryContext.tsx`; sprint-15 test asserts no `setInterval` |
| Cache freshness | none (every poll refetched state) | `staleTime: 15_000` aligned with poll | cached telemetry with staleTime | `telemetryQueryKeys.ts`; runtime dedupe test (`queryFn` ×1 on double fetch) |
| Referential stability | manual shallow-equal in provider | React Query `structuralSharing: true` | structural sharing active | `queryClient.ts`; runtime test — unchanged nested refs preserved |
| StrictMode duplicate fetch risk | remount could re-poll immediately | stale window covers poll interval | single wire per key on remount | `TELEMETRY_STALE_TIME_MS === TELEMETRY_POLL_INTERVAL_MS`; runtime staleTime dedupe |
| Dashboard React Query scope | N/A | telemetry provider only | do not migrate entire dashboard | grep: `useQuery` only in `WorkspaceTelemetryContext.tsx` |
| Error surfacing | implicit empty state on failure | `summaryError` / `analyticsError` + slice `error` | surface errors | `WorkspaceTelemetryContext.tsx` exports |

## Places for improvement

1. **StrictMode mount test** — Add `@testing-library/react` + `jsdom` to assert a double-mounted `WorkspaceTelemetryProvider` issues one bootstrap `fetch` per query key (current evidence uses QueryClient runtime analogue).
2. **Consumer error UI** — Slice hooks expose `error`, but `HomePage` / `ObservabilityPage` do not render telemetry failure banners yet; wire when UX copy is defined.
3. **Re-render profiler** — Future measurement sprint could capture before/after React Profiler render counts on unchanged 15s poll ticks.
