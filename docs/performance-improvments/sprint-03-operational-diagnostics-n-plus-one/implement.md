# Sprint-03 — Implementation: Fix Operational Diagnostics N+1

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** BUG-001, DB-002, OP-3, RC-004
- **Priority:** P0
- **Estimated effort:** <1 day

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. One batch query fetches all operations for listed traceIds
2. Response shape unchanged for dashboard consumers
3. Latency scales sub-linearly with limit

## Anti-objectives

1. Do not change buildOperationalDiagnostics report structure
2. Do not load full contextPackage when only error/stage needed
3. Do not remove snapshot attachment

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Replace per-trace retrievalOperation.findFirst in GET /diagnostics/operational with a single batch query.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Collect traceIds from listRetrievalTraces result
- [ ] 2. Batch findMany where traceId in (...)
- [ ] 3. Map results by traceId in historian.ts
- [ ] 4. Add unit/integration test
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **queries:** 100 → 1-2 per request
