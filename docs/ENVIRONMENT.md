# Environment setup

This guide covers every environment variable the repo uses, where to get each value, and how to wire **Supabase Postgres** (or local Docker) for development and deployment.

## Quick reference

| Variable | Used by | Required | Where to get it |
|----------|---------|----------|-----------------|
| `DATABASE_URL` | API, Prisma (runtime) | Yes | Supabase **Connect** / **Database** → connection string (pooler) |
| `DIRECT_URL` | Prisma migrations only | Yes* | Supabase **Connect** → **Direct connection** |
| `NODE_ENV` | API | Yes | `development` locally, `production` when deployed |
| `LOG_LEVEL` | API | No | `info` (default) |
| `API_HOST` / `API_PORT` | API | No | Defaults `0.0.0.0` / `3000` |
| `TRACE_HEADER` | API | No | Default `x-trace-id` |
| `OPENAI_API_KEY` | API, worker | No | [OpenAI API keys](https://platform.openai.com/api-keys) |
| `WORKER_POLL_INTERVAL_MS` | Worker | No | Default `2000` |
| `TEMPORARY_MEMORY_TTL_MS` | Worker | No | Default `3600000` |
| `VITE_API_URL` | Dashboard | Prod only | Your public API URL |
| `VITE_WORKSPACE_ID` | Dashboard | No | UUID from `POST /workspaces` |
| `SUPABASE_URL` / keys | — | **Not used** | Only if you add `supabase-js` later |

\*For local Docker, set `DIRECT_URL` the same as `DATABASE_URL`.

## Do I need Supabase API keys?

**No — not for the current codebase.**

The API uses **Prisma** with a standard **Postgres** connection (`DATABASE_URL`). It does not call the Supabase REST or Auth APIs, so `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are not read anywhere.

You only need:

1. A Supabase project (for hosted Postgres), and  
2. The **database password** and **connection strings** from the dashboard.

Optional Supabase keys are documented in `.env.example` for future Auth/client work.

---

## Local development (Docker Postgres)

1. Copy the template:

   ```bash
   cp .env.example .env
   ```

2. Start Postgres:

   ```bash
   npm run docker:up
   ```

3. Apply migrations and seed (optional):

   ```bash
   npm run db:migrate:deploy
   npm run db:seed
   ```

4. Run the API:

   ```bash
   npm run dev:api
   ```

5. Dashboard (optional):

   ```bash
   cp apps/dashboard/.env.example apps/dashboard/.env
   npm run dev:dashboard
   ```

   Leave `VITE_API_URL` empty locally; Vite proxies API routes to port 3000.

---

## Supabase Postgres setup

### 1. Create a project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard).
2. **New project** → choose org, name, region, and a **database password** (save it — you cannot recover it later, only reset).

### 2. Enable required extensions

This app uses **pgvector** and **pgcrypto** (see `apps/api/prisma/schema.prisma`).

1. In the project: **Database** → **Extensions**.
2. Search and enable **`vector`** (pgvector).
3. **`pgcrypto`** is usually enabled by default on Supabase; enable it if missing.

### 3. Get `DATABASE_URL` and `DIRECT_URL`

Open **Connect** (top of the project) or **Project Settings** → **Database**.

You need **two** URIs:

| Purpose | Supabase UI label | Typical host | Used for |
|---------|-------------------|--------------|----------|
| `DIRECT_URL` | **Direct connection** | `db.<project-ref>.supabase.co:5432` | `npm run db:migrate:deploy`, `db:migrate` |
| `DATABASE_URL` | **Session pooler** (port 5432) or **Transaction pooler** (port 6543) | `*.pooler.supabase.com` | Running API / worker in production |

**Steps:**

1. Open **Connect** → **ORMs** or **Connection string** → **URI**.
2. Copy the **Direct** URI → paste into `.env` as `DIRECT_URL`.
   - Replace `[YOUR-PASSWORD]` with your database password.
   - Append `?schema=public` if it is not already in the string.
3. Copy the **Session pooler** URI (recommended for Prisma runtime) → `DATABASE_URL`.
   - If you use the **Transaction** pooler on port **6543**, add `?pgbouncer=true` (and keep `schema=public`).

Example shape (values are yours):

```env
DATABASE_URL=postgresql://postgres.abcdefghijklmnop:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres?schema=public
DIRECT_URL=postgresql://postgres:[PASSWORD]@db.abcdefghijklmnop.supabase.co:5432/postgres?schema=public
```

**Password:** same password you set at project creation. Reset under **Project Settings** → **Database** → **Reset database password** if needed.

### 4. Configure `.env` and migrate

1. At repo root:

   ```bash
   cp .env.example .env
   ```

2. Paste `DATABASE_URL` and `DIRECT_URL` (comment out or remove the local Docker lines).

3. Run migrations against Supabase:

   ```bash
   npm run db:migrate:deploy
   ```

4. Start the API:

   ```bash
   npm run dev:api
   ```

### 5. OpenAI (optional)

For embeddings and abstraction features:

1. [platform.openai.com/api-keys](https://platform.openai.com/api-keys) → create a key.
2. Set `OPENAI_API_KEY=` in `.env`.

Without it, the API still runs; embedding-dependent paths log degradation.

---

## Vercel (or other hosts)

### API project

Set these in the host’s environment UI (not in git):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Supabase **pooler** URI (required at runtime) |
| `DIRECT_URL` | Supabase **direct** URI (required by Prisma schema; use the same value as `DATABASE_URL` if you only have one URI) |
| `NODE_ENV` | `production` |
| `LOG_LEVEL` | `info` |
| `OPENAI_API_KEY` | Your key (if using embeddings) |

Build uses `npm run build:api` from the monorepo root (`vercel.json`). `prisma generate` does not require `DATABASE_URL`; migrations and runtime do.

Run migrations separately (local CLI or CI) with `DIRECT_URL` / direct connection:

```bash
npm run db:migrate:deploy
```

### Dashboard project

| Variable | Value |
|----------|--------|
| `VITE_API_URL` | Public API origin, e.g. `https://your-api.vercel.app` |
| `VITE_WORKSPACE_ID` | Optional default workspace UUID |

Redeploy the dashboard after changing `VITE_*` variables (they are baked in at build time).

---

## Creating a workspace ID for the dashboard

After the API is up:

```bash
curl -X POST http://localhost:3000/workspaces \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"My workspace\"}"
```

Copy the returned `id` into `VITE_WORKSPACE_ID` in `apps/dashboard/.env`.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `DATABASE_URL is not set` | Create `.env` at **repo root** from `.env.example` |
| Prisma migrate fails on pooler URL | Use `DIRECT_URL` (direct host, port 5432) for migrate |
| `extension "vector" does not exist` | Enable **vector** under Supabase **Database** → **Extensions** |
| Dashboard cannot reach API | Set `VITE_API_URL` to the live API; enable CORS is already `*` on the API |
| Build can’t find `@memory-middleware/*` | Use monorepo build: `npm run build:api` from repo root (see root `vercel.json`) |
| `FUNCTION_INVOCATION_FAILED` on Vercel | Set `DATABASE_URL` (and `DIRECT_URL`); do **not** set `outputDirectory` on the API project; redeploy after `npm run build:api` so workspace `packages/*/dist` exists |

---

## File locations

| File | Purpose |
|------|---------|
| `.env.example` | API + worker template (copy to `.env` at repo root) |
| `apps/dashboard/.env.example` | Dashboard template |
| `apps/api/src/config/env.ts` | Validated API env schema |
| `apps/api/scripts/with-env.mjs` | Loads `.env` for Prisma CLI commands |
