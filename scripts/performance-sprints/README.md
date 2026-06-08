# Performance Sprint Runner

Automates the sprint pairs in `docs/performance-improvments/` using the [Cursor SDK](https://cursor.com/docs/sdk/typescript) (`@cursor/sdk`) with **local agents** against this repo.

## Prerequisites

1. **Cursor API key** — [Dashboard → Integrations](https://cursor.com/dashboard/integrations)

   Add to repo-root `.env` (loaded automatically by the runner):

   ```
   CURSOR_API_KEY=cursor_...
   ```

   Or set in the shell:

   ```powershell
   $env:CURSOR_API_KEY = "cursor_..."
   ```

2. **Install SDK** (dev dependency at repo root):

   ```bash
   npm install -D @cursor/sdk
   ```

3. **Repo ready** — API/dashboard deps installed, tests runnable:

   ```bash
   npm install
   npm run build:packages
   ```

## Quick start — Wave 1 (recommended first)

Wave 1 is the audit’s highest-ROI quick wins: dedupe, workspace ID, diagnostics N+1, health poll, ranking removal, React.memo.

```bash
# Dry-run: writes composed prompts into each sprint folder (no API call)
node scripts/performance-sprints/run-wave.mjs --wave 1 --dry-run

# Implement + verify each sprint sequentially
node scripts/performance-sprints/run-wave.mjs --wave 1
```

Single sprint:

```bash
node scripts/performance-sprints/run-sprint.mjs --sprint 03 --phase implement
node scripts/performance-sprints/run-sprint.mjs --sprint 03 --phase verify
```

## What each command does

| Command | Behavior |
|---------|----------|
| `run-sprint.mjs` | Loads `GLOBAL_PROMPT.md` + `implement.md` or `verify.md`, sends to local Cursor agent |
| `run-wave.mjs` | Runs many sprints in order; **implement then verify** per sprint |
| `--dry-run` | Writes `_last-implement-prompt.md` / `_last-verify-prompt.md` only |
| `--implement-only` | Skip verify phase (useful for batching implementations) |
| `--verify-only` | Run verify after you implemented manually |

Logs land in `docs/performance-improvments/sprint-XX-*/runs/*.log`.

## Cursor IDE (no SDK)

If you prefer the GUI:

1. Open **Agent** mode in Cursor.
2. Paste:

   ```
   Read docs/performance-improvments/GLOBAL_PROMPT.md
   Then execute docs/performance-improvments/sprint-03-operational-diagnostics-n-plus-one/implement.md
   Update outcomes.md as you go.
   ```

3. When done, new chat (or same agent):

   ```
   Read docs/performance-improvments/GLOBAL_PROMPT.md
   Then execute docs/performance-improvments/sprint-03-operational-diagnostics-n-plus-one/verify.md
   Score the implementation in outcomes.md.
   ```

Repeat per sprint. Use `docs/performance-improvments/README.md` for wave order.

## Cursor Cloud Agent (optional)

For long unattended waves on a clean VM:

- Use cloud runtime in a custom script (`cloud: { repos: ["your-org/semantic-core"] }`).
- Prefer **wave-by-wave PRs**, not all 39 sprints in one run.
- Set `skipReviewerRequest: true` in CI per SDK docs.

This repo’s default scripts use **local** agents so they edit your working tree directly.

## Resume after failure

1. Read `sprint-XX-*/outcomes.md` and `runs/*.log`.
2. Fix manually or re-run verify only:

   ```bash
   node scripts/performance-sprints/run-sprint.mjs --sprint 03 --phase verify
   ```

3. Continue wave from next sprint:

   ```bash
   node scripts/performance-sprints/run-wave.mjs --sprints 04,05,27,16
   ```

## Cost & time expectations

- **Wave 1** (~6 sprints × 2 phases): roughly 1–3 hours agent time, varies by model.
- **Full program** (39 sprints): run in waves over days; verify baselines (31–32) before claiming latency wins.

## Email notifications (Resend)

Add to `.env`:

```env
RESEND_API_KEY=re_...
PERF_NOTIFY_EMAIL=you@domain.com
RESEND_FROM_EMAIL=Perf <notify@yourdomain.com>
```

`perf:wave` auto-sends on success. Preview without sending:

```bash
npm run perf:notify -- --wave 1 --dry-run
```

Optional **Start Wave N+1** button in email — set `PERF_TRIGGER_PUBLIC_URL` (ngrok HTTPS) + `PERF_TRIGGER_SECRET`. **Remote setup:** [REMOTE_SETUP.md](./REMOTE_SETUP.md).

## Cursor skills

| Skill | Invoke | Purpose |
|-------|--------|---------|
| `remote-auto-dev` | `/remoteAutoDev` | Run waves, email, remote triggers |
| `performance-sprint-program` | — | Create new sprint pairs from audits |

## npm scripts

```bash
npm run perf:sprint -- --sprint 01 --phase implement
npm run perf:wave -- --wave 1
npm run perf:notify -- --wave 1 --dry-run
npm run perf:outcomes -- --wave 1
```
