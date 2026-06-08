# Dev Remote PWA (scaffold)

Phone control plane for perf waves and SDK sprint monitoring.

**Full design:** [`docs/remote-dev-pwa/ARCHITECTURE.md`](../../docs/remote-dev-pwa/ARCHITECTURE.md)

## Quick start

```powershell
# From repo root
npm install
npm run dev:api          # :3000
npm run perf:watch       # optional stall alerts
npm run dev:remote       # :5174
```

1. Open http://localhost:5174
2. **Setup** → paste token from `npm run perf:trigger-url -- --wave 2`
3. **Status** auto-refreshes every 30s
4. **Waves** → tap to start a wave on your PC

## Phone + tunnel

```powershell
ngrok http 3000
```

Set `VITE_PERF_API_BASE=https://YOUR.ngrok-free.app` in `apps/dev-remote/.env.local`, rebuild or use vite proxy in dev.

For installable PWA on phone, also tunnel `:5174` or deploy the built `dist/` behind the same origin as `/perf/*`.

## Unattended runs

```powershell
npm run perf:watch   # emails you if a sprint process stalls
npm run perf:wave -- --wave 2
```

Watchdog env vars: see ARCHITECTURE.md.
