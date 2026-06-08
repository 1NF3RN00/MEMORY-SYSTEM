# Sprint-20 Outcomes — Single Mobile/Desktop Panel Instance

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-19, FE-005
- **Priority:** P2
- **Effort:** <1 day

## Implementation summary

Refactored `HomePage.tsx` to mount **one** `LiveOperationalStream` and **one** `OperationalIntelligencePanels` instead of duplicating each behind `hidden lg:block` / `lg:hidden` branches.

### Structure change

| Before | After |
|--------|-------|
| Desktop grid: stream + panels in side columns (`hidden lg:block`) | Single instances placed via responsive grid columns |
| Mobile footer: duplicate stream + panels (`lg:hidden`) | Same instances in a mobile footer wrapper |
| 2× component mounts per panel | 1× mount each |

### Responsive layout technique

- **Mobile:** Map fills the main row; stream and panels share a footer row inside a wrapper with `max-h-[40vh]`, `border-t`, and `sm:grid-cols-2` (preserves prior mobile layout).
- **Desktop (`lg:`):** Wrapper uses `lg:contents` so its children participate directly in the three-column grid — stream at `lg:col-start-1`, map at `lg:col-start-2`, panels at `lg:col-start-3`.

### Files changed

| File | Change |
|------|--------|
| `apps/dashboard/src/pages/HomePage.tsx` | Single panel instances + responsive grid placement |
| `apps/dashboard/src/components/homepage/sprint-20-single-mobile-desktop-panel.test.ts` | Static verification tests for sprint objectives |

### Evidence

- `LiveOperationalStream` mount count in `HomePage.tsx`: **1** (was 2)
- `OperationalIntelligencePanels` mount count in `HomePage.tsx`: **1** (was 2)
- `useOperationalHomeData()` remains a **single** hook call at page level — no new subscriptions
- Tests: `sprint-20-single-mobile-desktop-panel.test.ts` (10/10 pass), `sprint-10-react-memo-home-panels.test.ts` (16/16 pass)

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Mobile/desktop layouts intact | Mobile footer retains `max-h-[40vh]`, `border-t`, `sm:grid-cols-2`; desktop retains three-column grid with stream left, map center, panels right via `lg:col-start-*` |
| No duplicate poll hooks | Did not add hooks to panel components; single `useOperationalHomeData()` at page level feeds both instances |
| GA-1 (retrieval ranking/thresholds) | Dashboard layout-only change; no retrieval pipeline or ranking code touched |
| GA-2 (non-deterministic tuning) | Pure CSS responsive layout; no heuristics or ML |
| GA-3 (trace payload compatibility) | No changes to trace payloads, API routes, or historian contracts |
| GA-4 (fabricated metrics) | Mount counts derived from source inspection and automated tests |
| GA-5 (scope creep) | Only `HomePage.tsx` layout refactor + sprint test file; no unrelated refactors |
| GA-6 (trace fields removal) | No `stages[]` or trace field changes |
| GA-7 (new DB tables) | Frontend-only change; no database work |

## Verification summary

Verification agent ran the sprint test suite and related homepage regression tests on 2026-06-08.

### Testing framework

| Check | Method | Result |
|-------|--------|--------|
| One instance each in tree | Static source analysis in `sprint-20-single-mobile-desktop-panel.test.ts` | 10/10 pass |
| Mobile/desktop QA | Assert responsive Tailwind classes (`lg:contents`, `lg:col-start-*`, mobile footer constraints) | Covered by sprint-20 tests |
| No double subscription | Assert single `useOperationalHomeData()` in `HomePage.tsx`; panel components do not import hook | Covered by sprint-20 tests |
| Regression safety | All homepage sprint tests (58 tests across 5 files) | 58/58 pass |

**Commands run:**

```bash
cd apps/dashboard
npm test -- sprint-20-single-mobile-desktop-panel.test.ts sprint-10-react-memo-home-panels.test.ts
npm test -- src/components/homepage/
```

### Objective results

| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | One stream + one panels in tree | **met** | `HomePage.tsx` contains exactly one `<LiveOperationalStream>` and one `<OperationalIntelligencePanels>`; duplicate `hidden lg:block` / `lg:hidden` pattern removed (git diff + sprint-20 tests lines 24–36) |
| 2 | Responsive CSS | **met** | Three-column grid template preserved; `lg:contents` wrapper defers children to desktop grid columns; mobile footer retains `max-h-[40vh]`, `border-t`, `sm:grid-cols-2` (sprint-20 tests lines 39–56; source lines 24–43) |
| 3 | Same subscriptions | **met** | Single `useOperationalHomeData()` call at page level; shared `events`, `panelData`, `loading` props passed to the one panel instances; no hook added inside `LiveOperationalStream.tsx` or `OperationalIntelligencePanels.tsx` (sprint-20 tests lines 59–79) |

### Anti-objective results

| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Mobile/desktop layouts intact | **no** | Prior mobile footer constraints and desktop three-column placement preserved via responsive classes; `ContextualIntelligenceMap` remains single center-column instance |
| No duplicate poll hooks | **no** | `useOperationalHomeData` appears once in `HomePage.tsx`; panel components contain no poll/query hooks |
| GA-1 (retrieval ranking) | **no** | No retrieval/compression pipeline files changed |
| GA-2 (non-deterministic tuning) | **no** | CSS-only layout refactor |
| GA-3 (trace payload compatibility) | **no** | No API or trace contract changes |
| GA-4 (fabricated metrics) | **no** | Mount counts verified by automated tests and source inspection |
| GA-5 (scope creep) | **no** | Changes limited to `HomePage.tsx` layout + sprint test file |
| GA-6 (trace fields removal) | **no** | No trace/historian schema changes |
| GA-7 (new DB tables) | **no** | Frontend-only |

### Regression

Retrieval/compression outputs unchanged — sprint scope is dashboard layout only; no backend or ranking code touched. Related homepage tests (sprint-10 memo, sprint-11 framer, sprint-16 lazy graph, sprint-28 health polling) all pass.

## Verification Score
- **Score:** 100 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

**Rubric breakdown:**

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | All three objectives met with automated + source evidence |
| Anti-objectives clean | 25% | 25 | Sprint and global anti-objectives verified clean |
| Test coverage | 20% | 20 | Dedicated sprint test file covers all objectives; homepage regression suite green |
| Regression safety | 15% | 15 | Layout-only change; 58 related homepage tests pass |

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| `LiveOperationalStream` mounts in HomePage | 2 | 1 | 2x → 1x | `sprint-20-single-mobile-desktop-panel.test.ts` (10/10 pass) |
| `OperationalIntelligencePanels` mounts in HomePage | 2 | 1 | 2x → 1x | `sprint-20-single-mobile-desktop-panel.test.ts` |
| `useOperationalHomeData` hook calls | 1 | 1 | unchanged | `HomePage.tsx` source + sprint-20 test |
| Homepage sprint regression tests | — | 58/58 pass | no regressions | `npm test -- src/components/homepage/` |

## Places for improvement

Score is 100; no blocking gaps. Optional future enhancements (out of sprint scope):

- Add a React Testing Library mount test to assert runtime DOM tree has one instance per panel at various viewport widths (static source tests cannot catch future duplicate JSX).
- Capture a visual snapshot or manual QA checklist screenshot pair for mobile vs desktop breakpoints for design review.
