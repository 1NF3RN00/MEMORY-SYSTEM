# Sprint-22 Outcomes — List Endpoint Field Projection

## Status
- **Implementation:** complete
- **Verification:** complete

## Audit mapping
- **IDs:** OP-21, RI-004
- **Priority:** P2
- **Effort:** 3-5 days

## Implementation summary

Added optional `?fields=` query projection to all dashboard-facing list routes while preserving full-row default responses.

### API

| File | Change |
|------|--------|
| `apps/api/src/lib/list-field-projection.ts` | **New** — per-resource allowlists, safe `?fields=` parsing, row projection helpers |
| `apps/api/src/lib/list-field-projection.test.ts` | Unit tests: default unchanged, projection, invalid-field rejection, ≥30% memory payload reduction |
| `apps/api/src/routes/memory.ts` | `GET /memory?fields=` |
| `apps/api/src/routes/retrieval.ts` | `GET /retrieval?fields=` |
| `apps/api/src/routes/ingestion.ts` | `GET /ingestion?fields=` |
| `apps/api/src/routes/compression.ts` | `GET /compression?fields=` |
| `apps/api/src/routes/context.ts` | `GET /context/render?fields=` |
| `apps/api/src/routes/sprint-22-list-field-projection.test.ts` | Route wiring + picker-shape regression tests |

**Behavior:**
- Omitting `fields` returns the same public row shape as before (default unchanged).
- `fields` is comma-separated; unknown tokens → **400** with `invalidFields`.
- Allowlists exclude internal columns (`result`, Prisma-only fields).

### Dashboard

| File | Change |
|------|--------|
| `apps/dashboard/src/lib/listFieldProjection.ts` | **New** — shared field bundles for telemetry and trace pickers |
| `apps/dashboard/src/lib/workspaceTelemetry.ts` | Analytics tier uses projected compression/context list fields |
| `apps/dashboard/src/pages/RetrievalDiagnosticsPage.tsx` | Retrieval picker: `retrievalTraceId,query,status` |
| `apps/dashboard/src/pages/CompressionTracesPage.tsx` | Retrieval picker for package selection |
| `apps/dashboard/src/pages/ContextDeliveryPage.tsx` | Projected retrieval + compression picker lists |
| `apps/dashboard/src/lib/sprint-22-list-field-projection.test.ts` | Source tests for telemetry + picker + full-page defaults |

**Unchanged (full rows by design):** `RetrievalTracesPage`, `MemoryExplorerPage`, `CompressionTracesPage` primary list, `IngestionTracesPage` — detail/table views still need complete list rows.

## Anti-objectives avoided

| Anti-objective | How avoided |
|----------------|-------------|
| Full rows by default | `parseListFieldsQuery` returns `fields: null` when param omitted; routes call `projectListRows(rows, null)` → identical output |
| No internal field leak | Only `LIST_FIELD_ALLOWLISTS` tokens accepted; `result`, `contextPackage`, etc. rejected with 400 |
| Safe parsing | Trim + dedupe comma tokens; empty token list → 400; no dynamic key access from user input beyond allowlist |
| GA-1 | Projection is response-shaping only; no ranking, threshold, or pipeline changes |
| GA-2 | Deterministic allowlist matching; no ML/heuristics |
| GA-3 | Detail routes (`/memory/:id`, `/retrieval/:traceId`, etc.) untouched |
| GA-4 | Payload reduction measured in `list-field-projection.test.ts` (42.3% on representative memory row) |
| GA-5 | Scope limited to list routes, projection helper, telemetry/picker consumers, tests |
| GA-6 | No `stages[]` or trace field removals from full/default responses |
| GA-7 | No schema migrations |

## Verification summary

### Test runs (2026-06-08)

| Suite | Command | Result |
|-------|---------|--------|
| API projection unit | `node --import tsx --test src/lib/list-field-projection.test.ts` | **8/8 pass** |
| API route wiring | `node --import tsx --test src/routes/sprint-22-list-field-projection.test.ts` | **5/5 pass** |
| Dashboard sprint-22 | `npx vitest run src/lib/sprint-22-list-field-projection.test.ts` | **3/3 pass** |

### Objective results
| # | Objective | Result | Evidence |
|---|-----------|--------|----------|
| 1 | fields limits columns | **met** | `projectListRow` + allowlist tests; route 400 on invalid tokens |
| 2 | Default unchanged | **met** | `fields: null` path returns full row; RetrievalTracesPage/MemoryExplorer unchanged |
| 3 | Dashboard uses where safe | **met** | `workspaceTelemetry` analytics + picker pages use `fields=`; full table pages keep default |

### Anti-objective results
| Anti-objective | Violated? | Evidence |
|----------------|-----------|----------|
| Full rows by default | **no** | Omitted `fields` test + unchanged full-page URLs |
| No internal field leak | **no** | `result`/`contextPackage` rejected; allowlist audit test |
| Safe parsing | **no** | Empty/invalid token tests return 400 |

### Rubric breakdown

| Dimension | Weight | Score | Notes |
|-----------|--------|-------|-------|
| Objectives met | 40% | 40 | 3/3 met |
| Anti-objectives clean | 25% | 25 | No violations |
| Test coverage | 20% | 18 | Unit + source + route wiring; no live Fastify inject |
| Regression safety | 15% | 15 | Default list shape preserved; detail routes untouched |
| **Overall** | | **98** | |

## Verification Score
- **Score:** 98 / 100
- **Objectives met:** 3 / 3
- **Anti-objectives violated:** none

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|
| memory list JSON (single row fixture) | 287 B full | 166 B projected (`id,title,memoryType,persistenceMode,archived`) | 30–50% reduction | `list-field-projection.test.ts` — **42.3%** smaller |
| retrieval picker row | 7 fields default | 4 fields projected | smaller wire for pickers | route test `projectListRows` shape |
| compression telemetry row | 7 fields default | 3 fields projected | smaller analytics poll | `TELEMETRY_COMPRESSION_LIST_FIELDS` |

## Places for improvement

- Add Fastify `inject` integration tests asserting 200 default vs 400 invalid `fields` per route.
- Extend `GET /workspaces/:id/dashboard-bootstrap` with optional `fields` if bootstrap list duplication becomes hot again.
- Wire `?fields=` on `/ingestion` for `IngestionTracesPage` if trace table columns are narrowed to a fixed subset.
