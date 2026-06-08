# Dashboard Home Load Benchmark

Repeatable measurement procedure for the operational dashboard home route (`/`). Closes **FE-002** and validates findings from [`DASHBOARD_LOAD_AUDIT.md`](../PERFORMANCE-AUDITS/DASHBOARD_LOAD_AUDIT.md).

This harness measures **network fan-out and JSON payload size** on home load. It does not change retrieval ranking, telemetry logic, or dashboard behavior.

---

## What gets measured

| Layer | Tool | Captures |
|-------|------|----------|
| **API mirror (primary)** | `npm run perf:bench-dashboard-load` | Request count, per-endpoint bytes, end-to-end latency mirroring `fetchWorkspaceTelemetry` + auth + lite graph |
| **Browser HAR (optional)** | `npm run perf:bench-dashboard-har` | Full Fetch/XHR from a real Chromium navigation; sanitized HAR artifact |
| **React Profiler (manual)** | DevTools checklist below | Re-render count from polling and canvas animation |

---

## Prerequisites

1. **API running:** `npm run dev:api` (default `http://localhost:3000`)
2. **Database seeded** with at least the default workspace (or set `BENCHMARK_WORKSPACE_ID`)
3. **Optional auth:** When the API requires authentication, set `BENCHMARK_API_KEY` or `BENCHMARK_AUTH_TOKEN`. Provision a read-scoped key with `npx tsx scripts/_provision-benchmark-key.ts <workspaceId>` (do not commit keys). For local dev without Supabase, auth resolves via `GET /workspaces/default`.
4. **Optional HAR:** Dashboard running (`npm run dev:dashboard`) and Playwright Chromium (`npx playwright install chromium`)

---

## Quick start — HTTP baseline (recommended)

From repo root:

```bash
npm run perf:bench-dashboard-load
```

Custom output path:

```bash
npx tsx scripts/benchmark-dashboard-load.ts \
  --samples 3 \
  --output docs/performance-improvments/sprint-32-dashboard-load-measurement-harness/runs/baseline.json
```

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `BENCHMARK_API_URL` | `http://localhost:3000` | API origin |
| `BENCHMARK_WORKSPACE_ID` | resolved from `/workspaces/default` | Target workspace |
| `BENCHMARK_AUTH_TOKEN` | — | Bearer token for `/auth/me` environments |
| `BENCHMARK_API_KEY` | — | `x-api-key` header |
| `BENCHMARK_SAMPLES` | `3` | Repeat full home-load cycles |
| `BENCHMARK_SKIP_AUTH` | `false` | Skip auth bootstrap on cycles after the first |
| `BENCHMARK_ALLOW_PROD` | — | Must be `true` for `*.vercel.app` hosts |

### Interpreting results

The JSON artifact includes:

- `aggregates.requestCount` — mean/p50 of HTTP requests per home load
- `aggregates.totalResponseKb` — mean/p50 JSON payload (response body bytes)
- `aggregates.endToEndMs` — wall-clock for auth → telemetry → graph
- `endpointAggregates[]` — top endpoints by total bytes
- `interpretation.payloadTier` — `empty` / `moderate` / `heavy` / `worst` vs audit ranges

**Audit reference (pre-optimization):**

| Metric | Expected range |
|--------|----------------|
| Request count (prod-like) | 12–16 Fetch/XHR |
| Payload (moderate workspace) | 300–1500 KB |
| Payload (empty workspace) | 5–30 KB |

Post–quick-win sprints may show **lower** request counts (dedupe, removed duplicate `/health`, no home `/ranking` follow-up, lite graph). Record actuals; do not force-fit audit numbers.

---

## Optional — Playwright HAR capture

Captures browser-level Fetch/XHR during navigation to `/`.

```bash
# One-time Playwright setup (not in package.json — install locally when needed)
npm install --no-save playwright@1.52.0
npx playwright install chromium
npm run perf:bench-dashboard-har
```

Options:

```bash
npx tsx scripts/benchmark-dashboard-har.ts \
  --dashboard-url http://localhost:5173 \
  --wait-ms 8000
```

**Security:** The script writes a **sanitized** HAR (`.sanitized.har`) with `Authorization`, `Cookie`, `x-api-key`, and post bodies redacted. Raw HAR is deleted unless `--keep-raw-har true` is passed for local debugging only. **Never commit raw HAR files.**

For prod-like request counts, run against a production build:

```bash
npm run build -w @memory-middleware/dashboard
npm run preview -w @memory-middleware/dashboard   # default http://localhost:4173
DASHBOARD_URL=http://localhost:4173 npm run perf:bench-dashboard-har
```

---

## React StrictMode vs production

`apps/dashboard/src/main.tsx` wraps the app in `<StrictMode>`. In **Vite dev**, mount effects run twice, which can **~double** initial Fetch/XHR compared to production.

| Environment | StrictMode double-fetch | Use for |
|-------------|-------------------------|---------|
| `npm run dev:dashboard` (5173) | **Yes** | Dev debugging only |
| `npm run preview` (4173) | **No** | Prod-like request counts |
| Deployed Vercel build | **No** | Production baseline |

Always note which mode a measurement used in `outcomes.md`.

---

## Manual Chrome DevTools procedure

Use when validating HAR/script output or capturing waterfall screenshots.

1. Open `http://localhost:5173/` (or preview URL).
2. DevTools → **Network** → filter **Fetch/XHR** → enable **Disable cache**.
3. Hard reload (Ctrl+Shift+R).
4. Record:
   - Total Fetch/XHR count when home panels stop loading
   - Sum of **Size** column (or export HAR → sum `response.bodySize`)
   - Time of last telemetry-related response (`/diagnostics/operational`, `/memory`, etc.)
5. Repeat on `/observability` to compare non-home fan-out.

---

## React Profiler checklist

Record a 30-second session on home (`/`):

- [ ] Start Profiler recording before hard reload
- [ ] Stop after telemetry poll cycle (~15 s) completes at least once
- [ ] Note **commit count** for `OperationalIntelligencePanels`, `LiveOperationalStream`, `ContextualIntelligenceMap`
- [ ] Flag commits driven by:
  - [ ] 15 s telemetry poll (`useOperationalHomeData`)
  - [ ] Canvas animation ticks (`ContextualIntelligenceMap`)
  - [ ] Clock/display timers (`OperationalSystemBar`)
- [ ] Compare before/after sprint using same workspace and browser zoom (100%)

Export flamegraph screenshot to sprint `runs/` if filing a regression.

---

## Before / after template

Copy into sprint `outcomes.md` Measurements table when comparing optimization sprints:

| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Home Fetch/XHR count (prod-like) | | | ≤ 12 | HTTP benchmark or sanitized HAR |
| Home JSON payload (KB) | | | ≤ 300 typical | `aggregates.totalResponseKb.mean` |
| End-to-end home load (ms p50) | | | lower | `aggregates.endToEndMs.p50` |
| Top endpoint by bytes | | | graph/diagnostics slimmed | `endpointAggregates[0]` |
| Profiler commits (30 s) | | | fewer poll-driven | React Profiler screenshot |
| Measurement mode | | | documented | `dev` / `preview` / `prod` |

---

## Automated tests

```bash
npx tsx --test scripts/benchmark-dashboard-load.test.ts
```

Covers telemetry path alignment, endpoint aggregation, payload tier classification, and HAR sanitization.

---

## Related documents

- [Dashboard Load Audit](../PERFORMANCE-AUDITS/DASHBOARD_LOAD_AUDIT.md)
- [Performance sprint-32 outcomes](../performance-improvments/sprint-32-dashboard-load-measurement-harness/outcomes.md)
- [Sprint-31 retrieval baseline](../performance-improvments/sprint-31-production-retrieval-baseline/outcomes.md)
