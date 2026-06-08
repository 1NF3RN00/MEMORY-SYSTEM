# Sprint-07 — Implementation: Database Query Observability Phases 1-3

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** MF-003, DB-001, OP-7, RC-003
- **Priority:** P0
- **Estimated effort:** ~1 week

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. Every Prisma op records duration in scoped retrieval
2. slowQueries and duplicateQueries populated
3. dbObservability on POST /retrieve response
4. EventLog exclusion prevents recursion

## Anti-objectives

1. Do not change query logic or retrieval results
2. Do not add migrations
3. Do not exceed 5ms overhead per query target
4. Do not break Prisma types

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Implement DB observability module, instrument Prisma, wrap POST /retrieve, attach dbObservability.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Add database-query-contracts to shared-types
- [ ] 2. Implement fingerprint, aggregator, scope, instrument-prisma
- [ ] 3. Replace bare client in database.ts
- [ ] 4. Wrap retrieval.ts with runWithDbObservationScope
- [ ] 5. Persist summary in retrieval-store
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **observability:** dbObservability live on retrieve
