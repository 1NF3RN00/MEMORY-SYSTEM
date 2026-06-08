# Wave definitions

Waves group sprint pairs into execution batches. **Canonical machine-readable list:** [`waves.json`](./waves.json). **Runner uses the same file** via `scripts/performance-sprints/waves.json` (symlinked copy — keep in sync).

## How waves relate to sprints

```
docs/performance-improvments/
├── WAVES.md              ← you are here (human guidelines)
├── waves.json            ← wave → sprint IDs (source of truth)
├── sprint-XX-<slug>/     ← implement.md + verify.md + outcomes.md
└── wave-reports/         ← aggregated outcomes + run logs + email previews
```

Each **sprint** = one deliverable (implement agent → verify agent).  
Each **wave** = ordered list of sprints run sequentially by `npm run perf:wave -- --wave N`.

## Running a wave

```bash
npm run perf:wave -- --wave 2
```

Per sprint the runner executes: **implement** → **verify** → next sprint.

**Email** sends only when the **entire wave finishes successfully** (`run-wave.mjs` → `notify-wave.mjs`). Partial waves do not auto-email.

## Wave catalog

### Wave 1 — Quick wins
**Sprints:** 01, 02, 03, 28, 06, 10  
**Goal:** Cut dashboard request waste and DB N+1 without touching retrieval algorithms.

### Wave 2 — Payload slimming
**Sprints:** 04, 05, 27, 16  
**Goal:** Shrink home-page JSON (lite graph, compression summary, slim diagnostics, deferred graph load).

### Wave 3 — Observability and baselines
**Sprints:** 31, 32, 07, 08, 09, 35, 38  
**Goal:** Real measurements and DB/LLM observability. Run **31–32 early** for baselines.

### Wave 4 — Dashboard data layer
**Sprints:** 12, 13, 14, 15  
**Goal:** React Query, bootstrap endpoint, shared telemetry context.

### Wave 5 — Render and UX polish
**Sprints:** 11, 19, 20, 21, 30  
**Goal:** Fewer re-renders and timer-driven updates.

### Wave 6 — Retrieval depth
**Sprints:** 17, 18, 29, 36, 39, 23, 24  
**Goal:** Retrieval latency tuning and pipeline timing completion.

### Wave 7 — Long-term
**Sprints:** 25, 26, 33, 34, 37  
**Goal:** Architectural spikes (WebSocket, metrics store, BM25 V2).

## Remote trigger (email button)

`GET /perf/trigger` spawns `npm run perf:wave` in the background. Requirements:

- PC awake with `npm run dev:api` + ngrok
- `PERF_TRIGGER_PUBLIC_URL` in `.env`
- Wave runs to completion → same email rules as manual run

**Run logs:** `wave-reports/wave-N-run-<timestamp>.log`

## Checking progress mid-wave

```bash
npm run perf:outcomes -- --wave 2
```

Or open each sprint's `outcomes.md` — Status lines show implement/verify state.

## After a wave completes

| Artifact | Location |
|----------|----------|
| Aggregated report | `wave-reports/wave-N-outcomes.md` |
| Email preview | `wave-reports/wave-N-email.html` (dry-run) |
| Resend delivery | inbox at `PERF_NOTIFY_EMAIL` |

Manual re-send:

```bash
npm run perf:notify -- --wave 2
```

## Adding or changing waves

1. Edit `waves.json` in this folder
2. Copy to `scripts/performance-sprints/waves.json` (or edit both)
3. Update this file's catalog section
4. Add sprint folders if new sprints are introduced
