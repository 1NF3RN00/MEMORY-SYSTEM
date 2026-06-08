# Sprint-07 — Verification: Database Query Observability Phases 1-3

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** MF-003, DB-001, OP-7, RC-003
- **Priority:** P0

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Every Prisma op records duration in scoped retrieval
2. slowQueries and duplicateQueries populated
3. dbObservability on POST /retrieve response
4. EventLog exclusion prevents recursion

## Anti-objectives to check

1. Do not change query logic or retrieval results
2. Do not add migrations
3. Do not exceed 5ms overhead per query target
4. Do not break Prisma types

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Database Query Observability Phases 1-3**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Unit tests: fingerprint, aggregator, scope
- [ ] 2. POST /retrieve returns dbObservability
- [ ] 3. Retrieval outputs identical before/after
- [ ] 4. Slow query threshold configurable
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **observability:** dbObservability live on retrieve
