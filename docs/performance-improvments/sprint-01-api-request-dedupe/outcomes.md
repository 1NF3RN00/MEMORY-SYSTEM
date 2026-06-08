# Sprint-01 Outcomes — API In-Flight Request Deduplication

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-1 (topOpportunities rank 1), BUG-003, FE-001
- **Priority:** P0
- **Effort:** <1 day

## Implementation summary

Added in-flight GET deduplication to `apps/dashboard/src/lib/api.ts`.

### Changes

1. **`inFlightGets` map** — `Map<string, Promise<unknown>>` keyed by resolved URL (`apiUrl(path)`).
2. **`apiGet` wrapper** — On call, checks the map for an existing promise for the same URL. If present, returns that promise (all concurrent callers await the same in-flight request). If absent, starts `apiRequest` + `parseApiResponse`, stores the promise, and returns it.
3. **Settle cleanup** — `.finally(() => inFlightGets.delete(url))` removes the entry on both success and failure so subsequent calls issue a fresh request.
4. **Error propagation** — Shared promise semantics: a rejection from `parseApiResponse` or `apiRequest` propagates to every waiter; no swallowing or per-caller isolation.

### Evidence (code)

```typescript
const inFlightGets = new Map<string, Promise<unknown>>();

export async function apiGet<T>(path: string, token?: string): Promise<T> {
  const url = apiUrl(path);
  const existing = inFlightGets.get(url);
  if (existing) return existing as Promise<T>;

  const promise = (async (): Promise<T> => {
    const response = await apiRequest(path, {}, token);
    return parseApiResponse<T>(response);
  })().finally(() => inFlightGets.delete(url));

  inFlightGets.set(url, promise);
  return promise;
}
```

### Duplicate calls addressed on home load

Concurrent callers of the same path during initial render (no cross-navigation cache):

| Path | Callers |
|------|---------|
| `/workspaces/default` | `workspaceTelemetry.ts`, `ContextualIntelligenceMap.tsx`, `AuthContext` fallback (when Supabase unconfigured) |
| `/health` | `workspaceTelemetry.ts`, `OperationalSystemBar.tsx` |

Expected reduction: **2–3 fewer duplicate HTTP requests** on home load when telemetry and UI components mount in parallel.

### Tests run (implementation)

- `npm run typecheck -w @memory-middleware/dashboard` — pass (no type regressions).

Automated dedupe behavior tests deferred to verification sprint (dashboard had no test runner configured).

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not cache responses across navigations (in-flight only) | Map entry deleted in `.finally()` on settle; no TTL, no response cache, no persistence. A new `apiGet` after the first completes always performs a new `fetch`. |
| Do not dedupe POST/PUT/PATCH/DELETE | Only `apiGet` was modified. `apiPost`, `apiPatch`, `apiDelete` unchanged. |
| Do not change API server behavior | Change is dashboard-only (`apps/dashboard/src/lib/api.ts`). No API route, middleware, or server code touched. |
| GA-1 (retrieval ranking/thresholds) | No retrieval pipeline or ranking logic modified. |
| GA-2 (autonomous agents / ML heuristics) | Pure promise-coalescing; deterministic URL-key lookup. |
| GA-3 (trace payload compatibility) | No trace or dashboard consumption shapes changed; `apiGet` return type and JSON parsing unchanged. |
| GA-4 (fabricated metrics) | No performance numbers claimed; duplicate-call analysis is static call-site inventory only. |
| GA-5 (scope creep) | Single file, ~15 lines; no refactors to AuthContext, workspaceTelemetry, or other sprints. |
| GA-6 (trace fields removal) | No trace or `stages[]` fields touched. |
| GA-7 (new DB tables) | No database changes. |

## Verification summary

### Testing framework

Added dashboard unit tests for in-flight deduplication:

| Artifact | Purpose |
|----------|---------|
| `apps/dashboard/src/lib/api.test.ts` | Six vitest cases with mocked `fetch` |
| `apps/dashboard/vitest.config.ts` | Isolated test config (no Vite/Tailwind plugin load) |
| `apps/dashboard/package.json` `test` script | `npx vitest@3.2.4 run --config vitest.config.ts` |

**Run command:** `npm run test -w @memory-middleware/dashboard`

**Result (2026-06-08):** 6/6 tests passed in 41ms.

| Test | Covers |
|------|--------|
| Concurrent identical `apiGet` → one `fetch` | Objective 1 |
| Different URLs → separate `fetch` calls | Objective 1 (negative case) |
| Sequential `apiGet` after settle → second `fetch` | Anti-objective: no cross-navigation cache |
| Error propagates to all concurrent waiters | Objective 2 (error path) |
| Failed in-flight settles → next `apiGet` succeeds | Objective 2 + anti-poison |
| `apiPost` not deduped | Anti-objective: mutating methods unchanged |

### Manual checklist (StrictMode / Network tab)

Not executed in this verification run (no browser session). Documented procedure for follow-up:

1. Start API + dashboard (`npm run dev:api`, `npm run dev:dashboard`).
2. Open `/` with DevTools → Network, disable cache, filter Fetch/XHR.
3. Confirm only **one** wire request each for `/workspaces/default` and `/health` during parallel home mount (telemetry + `ContextualIntelligenceMap` + `OperationalSystemBar`).
4. `main.tsx` uses `<StrictMode>` — overlapping in-flight duplicates are coalesced by unit-tested promise sharing; sequential remount after settle may still issue a second request (by design: in-flight only).

Static call-site evidence supports **−2 duplicate requests** on home load (see Measurements).

### Regression

- `apiGet` still returns parsed JSON via `parseApiResponse<T>`; response shapes unchanged.
- No API server files modified; retrieval/compression pipelines untouched.

### Objective results

| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Identical concurrent apiGet URLs produce one HTTP request | **met** | `api.test.ts` — `coalesces concurrent identical apiGet calls into one fetch`; `mockFetch.toHaveBeenCalledTimes(1)` |
| 2 | Dedupe map clears entries on settle (success or error) | **met** | Success: `issues a fresh fetch after the in-flight request completes` (2 fetches). Error: `allows a new request after a failed in-flight request settles` (2 fetches after 500) |
| 3 | No change to response shapes | **met** | Tests assert parsed object equality (`{ id: "ws-default" }`, etc.); `parseApiResponse` / `apiRequest` untouched; no API route changes |

### Anti-objective results

| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not cache responses across navigations | **no** | Sequential test proves second call fetches again with different body |
| Do not dedupe POST/PUT/PATCH/DELETE | **no** | `apiPost` test: 2 parallel calls → 2 fetches |
| Do not change API server behavior | **no** | `git diff` scope limited to `apps/dashboard/src/lib/api.ts` (+ verification test harness) |
| GA-1 | **no** | No retrieval/ranking changes |
| GA-2 | **no** | Deterministic URL-key map only |
| GA-3 | **no** | Trace/dashboard payload contracts unchanged |
| GA-4 | **no** | Measurements from static audit + test output only |
| GA-5 | **no** | Scoped to api client + sprint test files |
| GA-6 | **no** | No trace field removals |
| GA-7 | **no** | No DB changes |

## Verification Score
- **Score:** 94 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown**

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated evidence |
| Anti-objectives clean | 25% | 25 | Sprint + global anti-objectives verified |
| Test coverage | 20% | 17 | Full unit coverage; manual StrictMode Network tab not run in browser |
| Regression safety | 15% | 12 | Response parsing unchanged; no server diff — browser E2E not run |

## Measurements

| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Duplicate `GET /workspaces/default` on home load | 2 (telemetry + `ContextualIntelligenceMap`) | 1 (coalesced when concurrent) | −1 | `DASHBOARD_LOAD_AUDIT.md` request table; `api.test.ts` |
| Duplicate `GET /health` on home load | 2 (telemetry + `OperationalSystemBar`) | 1 (coalesced when concurrent) | −1 | Same audit; `api.test.ts` |
| **Total duplicate requests eliminated** | — | **−2** | −2 to −3 | Static call-site inventory + concurrent dedupe test |
| Unit tests (dedupe) | 0 | 6 passing | ≥1 coalesce test | `npm run test -w @memory-middleware/dashboard` output |

## Places for improvement

1. **Browser verification** — Run the manual Network-tab checklist in dev to confirm wire-level −2 on home load.
2. **Vitest install** — Hoist `vitest` into workspace `node_modules` so `npm run test` does not depend on `npx --yes` (current monorepo install omits dashboard devDependencies).
3. **StrictMode sequential remount** — If dev double-mount after settle still produces extra requests, address in a later sprint (e.g. shared data layer); out of scope for in-flight-only dedupe.
