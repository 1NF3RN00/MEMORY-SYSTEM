# Remote Dev PWA — Architecture

Phone-first control plane for **semantic-core** development: perf waves, SDK agents, API health, and dashboard telemetry — without opening Cursor on desktop.

## Problem

- Cursor SDK runs locally on your PC (`run-sprint.mjs` → `@cursor/sdk`)
- Email magic links can start waves but give no live visibility
- SDK agent teardown can hang after `status: finished`, blocking the wave queue
- You want full control from your phone while away

## Solution tiers

| Tier | What you get | Status |
|------|----------------|--------|
| **0 — Watchdog** | Timers + email on stall; dispose timeout prevents hangs | **shipped** |
| **1 — Email links** | Start next wave from Resend email | **shipped** |
| **2 — Dev Remote PWA** | Live status, wave controls, log tail on phone | **scaffolded** |
| **3 — Custom SDK prompts** | Send arbitrary agent tasks from PWA | **planned** |

## Topology

```
┌─────────────┐     HTTPS      ┌──────────────┐     localhost    ┌─────────────────┐
│ Phone PWA   │ ─────────────► │ ngrok/tunnel │ ───────────────► │ apps/api :3000  │
│ dev-remote  │   /perf/*      │              │                  │ perf-trigger    │
│  :5174      │                └──────────────┘                  └────────┬────────┘
└─────────────┘                                                           │
                                                                          │ spawn
                                                                          ▼
                                                               ┌──────────────────────┐
                                                               │ npm run perf:wave    │
                                                               │ run-sprint.mjs       │
                                                               │ @cursor/sdk (local)  │
                                                               └──────────────────────┘
```

**Critical constraint:** SDK agents always run on the awake dev machine. The PWA is a remote control panel, not a cloud IDE.

## API surface (existing + new)

| Endpoint | Purpose |
|----------|---------|
| `GET /perf/trigger?wave=N&token=` | Start wave N (HTML) |
| `GET /perf/status?wave=N&token=` | Wave PID, log path, stale flag |
| `GET /perf/dashboard?wave=N&token=` | JSON bundle for PWA |
| `GET /health` | API alive |

**Planned (Tier 3):**

| Endpoint | Purpose |
|----------|---------|
| `POST /perf/sprint` | `{ sprint, phase }` → spawn single sprint |
| `POST /perf/agent` | `{ prompt, model }` → ad-hoc SDK task |
| `GET /perf/logs/:sprint` | SSE or poll log tail |

All `/perf/*` routes use HMAC token: `HMAC-SHA256(PERF_TRIGGER_SECRET, "wave:N").slice(0,32)`.

## Watchdog (Tier 0)

### In-process (`run-sprint.mjs`)

| Env | Default | Behavior |
|-----|---------|----------|
| `PERF_SPRINT_DISPOSE_TIMEOUT_MS` | 30s | Force-exit if SDK `close()` hangs |
| `PERF_SPRINT_MAX_TIMEOUT_MS` | 90m | Hard cap per sprint phase |
| `PERF_SPRINT_INACTIVITY_TIMEOUT_MS` | off | Optional; disabled by default because tool/benchmark work is often silent |

### Background (`npm run perf:watch`)

| Env | Default | Behavior |
|-----|---------|----------|
| `PERF_WATCH_INTERVAL_MS` | 2m | Poll interval |
| `PERF_WATCH_STALE_MS` | 30m | Email alert if log silent while process alive |

Run in a second terminal whenever waves are unattended:

```powershell
npm run perf:watch
```

## PWA app (`apps/dev-remote`)

Scaffold only — you flesh out UI when back.

```
apps/dev-remote/
├── public/manifest.webmanifest   # Add to Home Screen
├── src/
│   ├── api/perf.ts               # Typed /perf/dashboard client
│   ├── pages/
│   │   ├── HomePage.tsx          # Wave cards + stale banner
│   │   ├── WavesPage.tsx         # Start / resume waves
│   │   └── AgentPage.tsx         # Future: custom SDK prompts
│   └── sw.ts                     # Offline shell (cache manifest)
```

### Dev setup

```powershell
# Terminal 1
npm run dev:api

# Terminal 2
ngrok http 3000

# Terminal 3 — watchdog (optional)
npm run perf:watch

# Terminal 4 — PWA
npm run dev:remote
```

Open PWA at `http://localhost:5174`. Set `VITE_PERF_API_BASE` to ngrok URL + store token from `npm run perf:trigger-url -- --wave 2`.

### PWA install (phone)

1. Tunnel API: ngrok → `:3000`
2. Serve PWA via tunnel on `:5174` (second ngrok or same host path rewrite)
3. Safari/Chrome → Add to Home Screen
4. `manifest.webmanifest` → `display: standalone`

## Security

- Never expose `CURSOR_API_KEY` to the PWA — API spawns local processes only
- Rotate `PERF_TRIGGER_SECRET` if link leaked
- Allowlist `PERF_NOTIFY_EMAIL` for inbound email triggers (Tier C)
- Consider device PIN / WebAuthn on PWA before showing controls

## Resume after stall

```powershell
Stop-Process -Id <stuck-pid> -Force
npm run perf:wave -- --wave 2 --sprints 27,16
```

Watchdog email includes PID + log path + tail for triage.

## Related docs

- `scripts/performance-sprints/REMOTE_SETUP.md` — ngrok + email
- `.cursor/skills/remote-auto-dev/SKILL.md` — agent orchestration
- `docs/performance-improvments/WAVES.md` — wave catalog
