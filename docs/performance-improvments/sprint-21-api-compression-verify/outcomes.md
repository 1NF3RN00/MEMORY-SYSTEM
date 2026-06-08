# Sprint-21 Outcomes — Verify API gzip/brotli Compression

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-20
- **Priority:** P2
- **Effort:** <1 day

## Implementation summary

**Finding:** The Fastify API had no response compression middleware. Large JSON payloads (telemetry bundles, graph data, trace lists) were sent uncompressed on the wire — Vercel edge may compress in production, but local dev and direct API access did not.

**Changes shipped:**

1. **`@fastify/compress`** added to `@memory-middleware/api` and registered via `registerResponseCompression()` in `create-app.ts` (before routes/middleware).
2. **`compression-env.ts`** — env-driven config:
   - `API_COMPRESSION_ENABLED` (default `true`; set `false` to disable)
   - `API_COMPRESSION_THRESHOLD_BYTES` (default `1024`; minimum body size before compression)
3. **Encodings:** brotli (`br`), gzip, deflate — negotiated via `Accept-Encoding`.
4. **`.env.example`** — compression vars documented under Observability section.
5. **Tests:** `compression-env.test.ts` (3) + `sprint-21-api-compression-verify.test.ts` (5) — 8/8 pass.

**Proxy check:** No reverse-proxy compression in repo (`apps/api/vercel.json` rewrites only). Compression is now handled in-app for consistent behavior across local and deployed runtimes.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not break SSE/binary | `@fastify/compress` skips incompressible content types (`text/event-stream`, `application/octet-stream`) via the `compressible` package. Test asserts SSE and binary responses have no `Content-Encoding`. Routes can opt out with `{ config: { compress: false } }`. |
| No CPU regression unmeasured | Small responses below threshold (default 1 KB) are not compressed — `/health` stays uncompressed. Test samples 30 `/health` inject calls; p95 latency < 25 ms with compression plugin registered. |
| GA-1 (ranking/threshold changes) | No retrieval, compression pipeline, or ranking logic modified. |
| GA-2 (non-deterministic tuning) | Static threshold + standard encodings only; no ML or adaptive tuning. |
| GA-3 (trace payload breakage) | Response bodies unchanged — only transport encoding added when client sends `Accept-Encoding`. |
| GA-4 (fabricated numbers) | Wire measurements from Fastify inject fixture (400 trace rows, ~370 KB JSON); see Measurements table. |
| GA-5 (scope creep) | Limited to compress registration, env config, `.env.example`, and sprint tests. |
| GA-6 (stages[] removal) | No trace or dashboard payload schema changes. |
| GA-7 (new DB tables) | No database changes. |

## Verification summary

**Testing framework:** Automated Node test suite (`compression-env.test.ts`, `sprint-21-api-compression-verify.test.ts`) using Fastify `inject()` — equivalent HTTP semantics to curl for `Accept-Encoding` negotiation and `Content-Encoding` headers on the wire (`rawPayload` byte length).

**Verification run (2026-06-08):**

```text
npx tsx --test src/config/compression-env.test.ts src/routes/sprint-21-api-compression-verify.test.ts
→ 8 pass, 0 fail (504 ms)
```

**Checklist:**

| Item | Result |
|------|--------|
| Content-Encoding gzip on large JSON | **Pass** — `content-encoding: gzip` when `Accept-Encoding: gzip` |
| Content-Encoding br when preferred | **Pass** — `content-encoding: br` when `Accept-Encoding: br, gzip` |
| Smaller transferred bytes | **Pass** — gzip wire ~98.5% below uncompressed fixture; exceeds 60–80% target |
| `/health` still fast | **Pass** — p95 inject latency 0.4 ms (30 samples); no `Content-Encoding` on small body |
| SSE/binary untouched | **Pass** — no `Content-Encoding`; bodies intact |
| Config documented | **Pass** — `.env.example` lines 48–53 |
| Regression (JSON bodies) | **Pass** — gunzip decode in test matches original `meta.count` |

**Note on curl:** Live `curl` against a spawned fixture server was attempted but blocked by Windows job startup timing in this environment. Inject-based tests are the repo’s established API verification pattern and assert the same headers/bytes a curl client would observe.

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | Content-Encoding on large JSON | **met** | Test cases assert `gzip` and `br` for `/large-json` with matching `Accept-Encoding`; gunzip round-trip preserves payload |
| 2 | Config documented | **met** | `.env.example` documents `API_COMPRESSION_ENABLED` and `API_COMPRESSION_THRESHOLD_BYTES` with behavior notes; `compression-env.test.ts` validates defaults |
| 3 | Wire size measured | **met** | Fixture 369,808 B uncompressed → gzip 5,729 B (98.5% reduction), br 3,955 B (98.9% reduction); test asserts `rawPayload.length < uncompressedBytes * 0.4` |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not break SSE/binary | **no** | SSE returns `data: fixture\n\n` with no encoding; binary octet-stream unchanged |
| No CPU regression unmeasured | **no** | `/health` p95 0.4 ms (<< 25 ms gate); below-threshold bodies skip compression |
| GA-1 | **no** | No retrieval/ranking/stage-order changes in sprint scope |
| GA-2 | **no** | Static env threshold only |
| GA-3 | **no** | Decoded JSON identical to source; transport-only encoding |
| GA-4 | **no** | Numbers from reproducible inject run |
| GA-5 | **no** | Scoped to compression middleware + tests |
| GA-6 | **no** | `stages[]` present in fixture and unchanged in decoded responses |
| GA-7 | **no** | No schema/migration work |

## Verification Score
- **Score:** 97 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown:**

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated evidence |
| Anti-objectives clean | 25% | 25 | Sprint + global anti-objectives verified |
| Test coverage | 20% | 17 | Strong inject suite; no repeatable live curl/smoke against full `create-app` binary |
| Regression safety | 15% | 15 | Gunzip decode + SSE/binary body checks confirm unchanged payloads |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| wire (large JSON fixture, 400 traces) | 369,808 B uncompressed, no `Content-Encoding` | gzip: 5,729 B (**98.5%** reduction); br: 3,955 B (**98.9%** reduction) | 60–80% on large JSON | `sprint-21-api-compression-verify.test.ts`; verification inject run 2026-06-08 |
| `/health` p95 inject latency (compression enabled) | — | 0.4 ms (30 samples) | no measurable CPU regression on small JSON | same test file, `keeps /health fast` case |

## Places for improvement
- Add a one-shot smoke script or CI step that curls a running API instance (full `create-app`) to complement inject fixtures — useful when proxy/header middleware ordering differs from isolated tests.
- Record a baseline “before” wire measurement in a fixed benchmark artifact so future sprints can diff without re-deriving pre-compression numbers.
