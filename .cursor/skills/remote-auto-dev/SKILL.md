---
name: remote-auto-dev
description: >-
  Run performance-improvement sprint waves via Cursor SDK locally or remotely,
  email wave outcomes through Resend, and trigger the next wave from signed links
  or inbound email. Use when the user mentions remoteAutoDev, /remoteAutoDev,
  automated sprint waves, Resend notifications, email-triggered agents, or running
  docs/performance-improvments sprints unattended.
disable-model-invocation: true
---

# Remote Auto Dev

Orchestrate **sprint pairs** in `docs/performance-improvments/` with optional **Resend email** notifications and **remote wave triggers**.

## When to use

- User invokes `/remoteAutoDev` or asks to run waves remotely
- User wants email when a wave finishes with outcomes summary
- User wants to start the next wave from phone/email without opening Cursor

## Architecture (3 tiers)

| Tier | What | Requires |
|------|------|----------|
| **A — Local + email** | `npm run perf:wave` on dev machine; Resend emails on complete | `CURSOR_API_KEY`, Resend keys, machine awake |
| **B — Magic link** | Email contains "Start Wave N" button → HTTPS endpoint queues wave | Deployed API + `PERF_TRIGGER_*` env |
| **C — Reply by email** | Reply `START WAVE 2` → Resend Inbound webhook → same endpoint | Resend Inbound + verified domain |

Start with **Tier A**. Add **Tier B** before reply parsing (simpler, more secure).

## Required env (repo-root `.env`)

```env
CURSOR_API_KEY=cursor_...
RESEND_API_KEY=re_...
PERF_NOTIFY_EMAIL=you@yourdomain.com
RESEND_FROM_EMAIL=Perf <notify@yourdomain.com>

# Optional — magic links in email (Tier B)
PERF_TRIGGER_BASE_URL=https://your-api.example.com
PERF_TRIGGER_SECRET=long-random-string-min-32-chars
```

## Commands

```bash
# Run wave (auto-emails on success if Resend configured)
npm run perf:wave -- --wave 1

# Skip email
npm run perf:wave -- --wave 1 --no-notify

# Preview email HTML without sending
npm run perf:notify -- --wave 1 --dry-run

# Collect outcomes only
node scripts/performance-sprints/collect-wave-outcomes.mjs --wave 1
```

## Agent workflow

When user asks to run a wave remotely:

1. Read `docs/performance-improvments/GLOBAL_PROMPT.md`
2. Confirm `CURSOR_API_KEY` in `.env` (never print the value)
3. Run `npm install -D @cursor/sdk` if missing
4. Execute `npm run perf:wave -- --wave <N>`
5. On completion, verify `docs/performance-improvments/wave-reports/wave-N-outcomes.md`
6. If notification failed, run `npm run perf:notify -- --wave <N>` manually

When user asks to **start next wave from email**:

- **Tier B:** Ensure `PERF_TRIGGER_BASE_URL` points to deployed `GET /perf/trigger` (see [reference.md](reference.md))
- **Tier C:** Configure Resend Inbound → webhook; parse body for `START WAVE <n>`

## Email contents

Each notification includes:

- Sprint table (impl/verify status, scores from `outcomes.md`)
- Full markdown report attachment in body
- Saved copy at `docs/performance-improvments/wave-reports/wave-N-outcomes.md`
- Optional CTA link to start wave N+1

## Safety rules

- Never commit API keys or paste them in chat
- Never auto-start wave N+1 without explicit user config (email link or reply)
- Stop the wave on first sprint failure; do not skip verify phase
- Do not change retrieval algorithms unless sprint scope allows (GA-1)

## Related skills

- **performance-sprint-program** — create new sprint pairs from audits
- `docs/performance-improvments/README.md` — wave catalog (7 waves, 39 sprints)

## Deep reference

- Trigger API design: [reference.md](reference.md)
- Resend setup: [reference.md](reference.md#resend-setup)
