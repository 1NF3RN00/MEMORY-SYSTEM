# Sprint-03 — Verification: Fix Operational Diagnostics N+1

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** BUG-001, DB-002, OP-3, RC-004
- **Priority:** P0

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. One batch query fetches all operations for listed traceIds
2. Response shape unchanged for dashboard consumers
3. Latency scales sub-linearly with limit

## Anti-objectives to check

1. Do not change buildOperationalDiagnostics report structure
2. Do not load full contextPackage when only error/stage needed
3. Do not remove snapshot attachment

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Fix Operational Diagnostics N+1**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Log or mock Prisma call count: O(1) not O(n)
- [ ] 2. Compare report output before/after with fixture traces
- [ ] 3. Load test with limit=100
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **queries:** 100 → 1-2 per request
