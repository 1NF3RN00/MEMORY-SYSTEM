# Sprint-08 — Verification: DB Observability Phase 4 — Leaderboard & Scopes

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** AR-005, DATABASE_QUERY_OBSERVABILITY
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Top-20 leaderboard by totalDbTime
2. HTTP and worker scopes emit database.scope.completed
3. Worker uses instrumented client

## Anti-objectives to check

1. Do not require new DB tables
2. Do not instrument EventLog recursively
3. Document cold-start leaderboard limitation

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **DB Observability Phase 4 — Leaderboard & Scopes**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Leaderboard updates after retrieve
- [ ] 2. Worker job produces scope summary
- [ ] 3. Parallel scopes isolated
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **endpoint:** GET /diagnostics/db-operations?limit=20
