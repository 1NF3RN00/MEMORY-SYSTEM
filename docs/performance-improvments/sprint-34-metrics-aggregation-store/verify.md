# Sprint-34 — Verification: Metrics Aggregation Store

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** AR-002
- **Priority:** P3

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Counters on operation complete
2. Dashboard reads aggregation
3. Migration documented

## Anti-objectives to check

1. Historian full traces intact
2. Consistent dual-write
3. No over-engineering

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Metrics Aggregation Store**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Counts match sample scan
- [ ] 2. Lower query cost
- [ ] 3. Reversible migration
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **db:** O(1) metrics read
