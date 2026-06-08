# Sprint-11 Outcomes — Remove Framer Layout on Event Cards

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-10, FE-005
- **Priority:** P1
- **Effort:** <1 day

## Implementation summary

Removed Framer Motion layout-driven reflow from `LiveOperationalStream` event cards:

1. **Removed `layout` prop** from `motion.article` in `EventCard` — cards no longer participate in Framer's shared layout animation pipeline on every poll-driven `events` reference change.
2. **Dropped `mode="popLayout"`** on the stream's `AnimatePresence` — `popLayout` coordinates layout shifts when items exit; unnecessary without per-card `layout` and avoids extra layout measurement on poll updates.
3. **Preserved enter/exit motion** — `initial` / `animate` / `exit` opacity + x transitions remain on each card; expand/collapse detail panel animation unchanged.
4. **CSS transitions intact** — `transition-colors` on hover and `transition-opacity` on the "Expand for lineage" hint unchanged.

**Evidence (code):**

- `apps/dashboard/src/components/homepage/LiveOperationalStream.tsx` — no `layout` or `popLayout` references; enter/exit variants retained on lines 22–25.
- Dashboard test suite: **120/120 passed** (`npm run test --workspace=@memory-middleware/dashboard`).

**Profiling note:** React Profiler / Performance panel capture was not run in this implementation pass (no headed browser in CI shell). Layout thrash elimination is inferred from removing the documented hot path per `DASHBOARD_LOAD_AUDIT.md` §5.5; verification sprint should confirm with Profiler if needed.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Do not remove all motion without UX note | Enter/exit opacity + slide (`initial`/`animate`/`exit`) and expand-panel height animation preserved; only layout reflow animation removed. |
| Do not break stream accessibility | No DOM structure or ARIA changes; `motion.article` retained; click-to-expand and text content unchanged. |
| Do not change event ordering | `events.map` order and `key={event.id}` unchanged; no sort/filter logic touched. |
| GA-1 | No retrieval ranking, thresholds, or pipeline changes. |
| GA-2 | No ML/heuristic tuning; CSS + Framer variant props only. |
| GA-3 | No trace payload or dashboard API contract changes. |
| GA-4 | No fabricated metrics; measurements table left for verification. |
| GA-5 | Single-file dashboard change within sprint scope. |
| GA-6 | No `stages[]` or historian trace fields removed. |
| GA-7 | No database or schema changes. |

## Verification summary

Verification added `sprint-11-remove-framer-layout-events.test.ts`, ran the full dashboard suite, and independently confirmed sprint + global anti-objective scope.

**Test commands (2026-06-08):**

- `npm run test --workspace=@memory-middleware/dashboard` — **131/131 passed** (11 sprint-11 tests)
- `npm run typecheck --workspace=@memory-middleware/dashboard` — fails on pre-existing errors in `workspaceTelemetry.ts` (outside sprint-11 scope); `LiveOperationalStream.tsx` unchanged by type errors

**Testing framework delivered:**

1. **Layout hot-path removal** — static source audit confirms no `layout` on `motion.article` and no `mode="popLayout"` on stream `AnimatePresence`.
2. **Enter/exit preserved** — source audit confirms opacity + x variants on cards and height animation on expand panel; CSS `transition-colors` / `transition-opacity` intact.
3. **Layout measurement model** — deterministic model: 10 cards × 4 unchanged 15s polls → **40 → 0** Framer layout measurements (100% reduction on stable polls per `DASHBOARD_LOAD_AUDIT.md` §5.5).
4. **Event ordering** — `events.map` with `key={event.id}` unchanged; no sort/reverse helpers added.
5. **Accessibility** — semantic `motion.article`, click-to-expand handler, title/detail text rendering unchanged.

**Independent checks:**

- Git diff limited to `LiveOperationalStream.tsx` for sprint-11 scope (`layout` removed, `popLayout` removed; memo from Sprint-10 retained).
- No retrieval/compression/API route changes in sprint scope.
- Visual enter/exit and scroll jank not captured in headed browser (documented gap; see Places for improvement).

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | No layout animations on poll updates | **met** | No `layout` on `motion.article`; no `popLayout` on stream `AnimatePresence`; stable `key={event.id}` mapping (source + 3 tests) |
| 2 | Enter/exit preserved if desired | **met** | `initial`/`animate`/`exit` opacity+x on cards; expand panel height animation; CSS hover transitions (source + 3 tests) |
| 3 | Reduced main-thread work | **met** | Layout measurement model: 40 → 0 measurements over 4 stable polls (100% reduction); audit §5.5 hot path removed in code (runtime Profiler not captured) |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Do not remove all motion without UX note | **no** | Enter/exit + expand height animations + CSS transitions all present (tests) |
| Do not break stream accessibility | **no** | `motion.article`, click handler, title/detail unchanged (test) |
| Do not change event ordering | **no** | `events.map` order preserved; no sort/reverse (test) |
| GA-1 (retrieval determinism) | **no** | Dashboard-only Framer prop change |
| GA-2 (non-deterministic tuning) | **no** | Static prop removal only |
| GA-3 (trace payload compat) | **no** | No trace/stages field changes |
| GA-4 (fabricated numbers) | **no** | Layout measurement counts derived from deterministic model (10 cards × 4 polls), not synthetic browser claims |
| GA-5 (scope creep) | **no** | Single component + verification test file |
| GA-6 (trace field removal) | **no** | No trace fields removed |
| GA-7 (new DB tables) | **no** | No database changes |

### Regression
Retrieval/compression outputs unchanged — sprint touched only dashboard Framer props in `LiveOperationalStream.tsx`; no backend or pipeline diffs in sprint scope.

## Verification Score
- **Score:** 97 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 100 | All three objectives met with code + automated test evidence |
| Anti-objectives clean | 25% | 100 | Sprint + GA-1–GA-7 clean |
| Test coverage | 20% | 85 | 11 automated source + layout-model tests; no browser React Profiler or RTL visual harness |
| Regression safety | 15% | 100 | No retrieval/compression/API trace changes in sprint scope |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| Framer layout measurements (10 cards, 4 stable 15s polls) | 40 (10 per poll) | 0 | layout thrash eliminated on poll | Layout measurement model in `sprint-11-remove-framer-layout-events.test.ts`; audit §5.5 hot path removed |
| `layout` prop on event cards | present | removed | removed | `LiveOperationalStream.tsx` git diff; source test |
| `AnimatePresence mode="popLayout"` | present | removed | removed | source test |
| Enter/exit card motion | opacity + x | unchanged | preserved | source test |
| automated test pass rate | — | 131/131 | all pass | dashboard vitest run 2026-06-08 |

## Places for improvement
- Capture browser React Profiler / Performance panel during 15s home polling to record actual layout recalc counts (model is deterministic but not runtime-measured).
- Add React Testing Library render test simulating poll with identical event IDs to assert no Framer layout animation triggers.
- Optional Playwright visual check for enter/exit when new events arrive and scroll stability during poll updates.
