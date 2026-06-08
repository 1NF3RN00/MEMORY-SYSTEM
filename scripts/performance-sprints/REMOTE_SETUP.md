# Remote perf waves (phone → your desktop)

Your desktop runs Cursor SDK waves. Resend emails you anywhere. The **magic link** needs a public URL that forwards to `localhost:3000`.

## What runs where

| Piece | Where | Why |
|-------|-------|-----|
| `npm run perf:wave` | Your PC | Cursor SDK is local |
| `npm run dev:api` | Your PC :3000 | Receives trigger, spawns wave |
| Resend email | Cloud | Works from phone already |
| ngrok / Cloudflare Tunnel | Public HTTPS → :3000 | Phone can click "Start Wave N" |

You do **not** deploy the trigger to Vercel — serverless can't run local Cursor agents.

---

## Option A — ngrok (fastest, ~5 min)

### 1. Install ngrok

- Download: https://ngrok.com/download
- Or: `winget install ngrok.ngrok`
- Sign up, copy authtoken: https://dashboard.ngrok.com/get-started/your-authtoken

```powershell
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
```

### 2. Three terminals on your PC (leave open)

**Terminal 1 — API**
```powershell
cd c:\Users\james\semantic-core
npm run dev:api
```

**Terminal 2 — Tunnel**
```powershell
ngrok http 3000
```

Copy the **Forwarding** HTTPS URL, e.g. `https://abc123.ngrok-free.app`

**Terminal 3 — Waves (when needed)**
```powershell
npm run perf:wave -- --wave 1
```

### 3. Add public URL to `.env`

```env
PERF_TRIGGER_PUBLIC_URL=https://abc123.ngrok-free.app
```

No API restart needed for *email links* — `notify-wave.mjs` reads this when sending. Restart API only if you changed `PERF_TRIGGER_SECRET`.

### 4. Test from phone

Open in phone browser (or tap email button after next wave):

```
https://abc123.ngrok-free.app/perf/trigger?wave=2&token=TEST
```

Invalid token → 403 HTML (good — endpoint is reachable).  
Valid token → only in real email after wave completes.

Quick local token test (PowerShell):

```powershell
node -e "
const c=require('crypto');
const s=process.env.PERF_TRIGGER_SECRET;
const w=2;
const t=c.createHmac('sha256',s).update('wave:'+w).digest('hex').slice(0,32);
console.log(process.env.PERF_TRIGGER_PUBLIC_URL+'/perf/trigger?wave='+w+'&token='+t);
"
```

(Run from repo root after `.env` is loaded, or paste secret manually.)

### 5. ngrok free tier notes

- URL **changes** each time you restart ngrok → update `PERF_TRIGGER_PUBLIC_URL` before the next completion email.
- First visit may show ngrok interstitial — tap through once.

---

## Option B — Cloudflare Tunnel (stable URL, more setup)

Good if you want a fixed subdomain without ngrok's random URL.

1. Install `cloudflared`: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
2. `cloudflared tunnel --url http://localhost:3000`
3. Use the printed `*.trycloudflare.com` URL as `PERF_TRIGGER_PUBLIC_URL`

---

## Checklist — "totally remote right now"

- [ ] PC awake, not sleeping
- [ ] `npm run dev:api` running
- [ ] ngrok (or cloudflared) forwarding to 3000
- [ ] `.env`: `RESEND_API_KEY`, `PERF_NOTIFY_EMAIL=james@midgleysolutions.com`, `RESEND_FROM_EMAIL=Semantic Core Perf <system@midgleysolutions.com>`, `PERF_TRIGGER_PUBLIC_URL=https://...`
- [ ] Wave running or triggered via email

When a wave **finishes**, email goes to james@midgleysolutions.com with outcomes + **Start Wave N+1** button. Tap on phone → tunnel → your PC starts the next wave.

---

## If Wave 1 email already sent without the button

Re-send after tunnel is up:

```powershell
npm run perf:notify -- --wave 1
```

---

## Watchdog (unattended runs)

Sprint runs can hang after the SDK finishes (`agent.close()` never returns). Shipped mitigations:

| Command / env | Purpose |
|---------------|---------|
| `npm run perf:watch` | Background monitor; emails if log silent 30+ min while process alive |
| `PERF_SPRINT_DISPOSE_TIMEOUT_MS=30000` | Force-exit after dispose hang (default 30s) |
| `PERF_SPRINT_MAX_TIMEOUT_MS=5400000` | Hard cap per sprint phase (default 90 min) |
| `PERF_SPRINT_INACTIVITY_TIMEOUT_MS` | **Off by default** — agents run long tool/benchmark work without streaming text |
| `PERF_WATCH_STALE_MS=1800000` | Stall alert threshold for `perf:watch` (default 30 min) |

**Recommended when away:** run `perf:watch` in a second terminal alongside `perf:wave`.

### Live terminal output (tool/shell activity)

By default, `run-sprint.mjs` streams **tool calls, shell output, steps, and status** — not just assistant text. Long quiet periods usually mean the agent is running commands without narrating.

| Env | Default | Effect |
|-----|---------|--------|
| `PERF_SPRINT_VERBOSE` | on | Show `[tool]`, `▶ shell`, `[step]`, shell stdout chunks |
| `PERF_SPRINT_VERBOSE=0` | — | Text-only mode (old behavior) |

Example output during a benchmark sprint:

```text
▶ shell: npm run docker:up
[tool] shell (running) — npm run docker:up
...docker pull output streams here...
✓ shell done
[step 3] 42s
```

```powershell
# Terminal A
npm run perf:wave -- --wave 2

# Terminal B
npm run perf:watch
```

## Dev Remote PWA (phone dashboard)

Scaffold at `apps/dev-remote` — see `docs/remote-dev-pwa/ARCHITECTURE.md`.

```powershell
npm run dev:remote   # :5174, proxies /perf to :3000
```

API JSON: `GET /perf/dashboard?wave=N&token=`

---

## Security

- Links require HMAC token (`PERF_TRIGGER_SECRET`) — don't share raw trigger URLs.
- Keep ngrok URL private; rotate `PERF_TRIGGER_SECRET` if leaked.
- Only `/perf/trigger`, `/perf/status`, and `/perf/dashboard` are public (no auth routes exposed).
