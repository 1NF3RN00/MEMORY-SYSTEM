# Sprint-08 — Implementation: DB Observability Phase 4 — Leaderboard & Scopes

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** AR-005, DATABASE_QUERY_OBSERVABILITY
- **Priority:** P1
- **Estimated effort:** 3-5 days

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. Top-20 leaderboard by totalDbTime
2. HTTP and worker scopes emit database.scope.completed
3. Worker uses instrumented client

## Anti-objectives

1. Do not require new DB tables
2. Do not instrument EventLog recursively
3. Document cold-start leaderboard limitation

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

GET /diagnostics/db-operations, request/worker scopes.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Implement leaderboard ring buffer
- [ ] 2. Add diagnostics route
- [ ] 3. Wire create-app.ts request scope
- [ ] 4. Wire worker-main.ts job scope
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **endpoint:** GET /diagnostics/db-operations?limit=20
