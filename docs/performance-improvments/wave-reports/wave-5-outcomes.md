# Wave 5 outcomes — Render and UX polish
- **Focus:** Framer layout, ref-based timers, single panel instance, gzip, compression trace UX.
- **Generated:** 2026-06-08T21:10:21.227Z
- **Sprints:** 5/5 verified complete
- **Average score:** 97/100
| Sprint | Folder | Impl | Verify | Score | Objectives |
|--------|--------|------|--------|-------|------------|
| 11 | sprint-11-remove-framer-layout-events | complete | complete | 97 | 3 / 3 |
| 19 | sprint-19-ref-based-canvas-clock | complete | complete | 97 | 3/3 |
| 20 | sprint-20-single-mobile-desktop-panel | complete | complete | 100 | 3 / 3 |
| 21 | sprint-21-api-compression-verify | complete | complete | 97 | 3 / 3 |
| 30 | sprint-30-compression-trace-id-ux | complete | complete | 94 | 3 / 3 |

## Per-sprint notes

### sprint-11-remove-framer-layout-events

Removed Framer Motion layout-driven reflow from `LiveOperationalStream` event cards:

1. **Removed `layout` prop** from `motion.article` in `EventCard` — cards no longer participate in Framer's shared layout animation pipeline on every poll-driven `events` reference change.
2. **Dropped `mode="popLayout"`** on the stream's `AnimatePresence` — `popLayout` coordinates layout shifts when items exit; unnecessary without per-card `layout` and avoids extra layout measurement on poll updates.
3. **Preserved enter/exit motion** — `initial` / `animate` / `exit` opacity + x transitions remain on each card; expand/collapse detail panel animation unchanged.
4. **CSS transitions intact** — `transition-colors` on hover and `transition-opacity` on the "Expand for lineage" hint unchanged.

---

### sprint-19-ref-based-canvas-clock

Replaced timer-driven React state with direct DOM ref updates in two hotspots:

1. **`ContextualIntelligenceMap.tsx` — phase label**
   - Removed `useState` for `phaseLabel` / `setPhaseLabel`.
   - Added `phaseLabelElementRef` on the header `<span>`.
   - `updatePhaseLabel` now writes `phaseLabelElementRef.current.textContent` (with dedup via existing `phaseLabelRef`).
   - Initial label text remains `"Context assembly idle"` as static children for first paint.

2. **`AppShell.tsx` — `TopBarClock`**
   - Removed `useState` + `setTime` interval commits.
   - Wrapped component in `React.memo`.
   - Added `clockRef` on inner time `<span>`; interval callback sets `textContent` via `toISOString().slice(11, 19)` (UTC, unchanged).
   - `clearInterval` on unmount preserved.
   - Initial time rende

---

### sprint-20-single-mobile-desktop-panel

Refactored `HomePage.tsx` to mount **one** `LiveOperationalStream` and **one** `OperationalIntelligencePanels` instead of duplicating each behind `hidden lg:block` / `lg:hidden` branches.

### Structure change

| Before | After |
|--------|-------|
| Desktop grid: stream + panels in side columns (`hidden lg:block`) | Single instances placed via responsive grid columns |
| Mobile footer: duplicate stream + panels (`lg:hidden`) | Same instances in a mobile footer wrapper |
| 2× component mounts per panel | 1× mount each |

### Responsive layout technique

- **Mobile:** Map fills the main row; stream and panels share a footer row inside a wrapper with `max-h-[40vh]`, `border-t`, and `sm:grid-cols-2` (preserves prior mobile layout).
- *

---

### sprint-21-api-compression-verify

**Finding:** The Fastify API had no response compression middleware. Large JSON payloads (telemetry bundles, graph data, trace lists) were sent uncompressed on the wire — Vercel edge may compress in production, but local dev and direct API access did not.

**Changes shipped:**

1. **`@fastify/compress`** added to `@memory-middleware/api` and registered via `registerResponseCompression()` in `create-app.ts` (before routes/middleware).
2. **`compression-env.ts`** — env-driven config:
   - `API_COMPRESSION_ENABLED` (default `true`; set `false` to disable)
   - `API_COMPRESSION_THRESHOLD_BYTES` (default `1024`; minimum body size before compression)
3. **Encodings:** brotli (`br`), gzip, deflate — negotiated via `Accept-Encoding`.
4. *

---

### sprint-30-compression-trace-id-ux

Improved compression vs retrieval trace ID UX across API, client, and dashboard.

### API (`compression-store.ts`, `compression.ts`)
- Added `CompressionContextResolveError` contract in `packages/shared-types/src/compression-contracts.ts` with `code`, `suppliedTraceId`, `retrievalTraceId`, and `compressionTraceId`.
- Extracted `buildCompressionTraceIdMismatchError()` for the compression-trace-ID branch in `resolveContextPackage()`.
- `POST /compress` now returns the full structured 400 body (not only `error` string) when the wrong trace ID type is supplied.

### Dashboard client
- Added `ApiError` in `apps/dashboard/src/lib/api.ts` to preserve structured error fields (`code`, `retrievalTraceId`, `compressionTraceId`).
- Added `apps/dashboard/src/lib/compressionTraceId.ts

---
