# Sprint-17 — Verification: pgvector Index EXPLAIN Review

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-16, LAT-001, MF-001
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. EXPLAIN captured for representative queries
2. Index usage documented
3. Recommendations evidence-based only

## Anti-objectives to check

1. No index change without measurement
2. No candidate limit changes
3. No fabricated EXPLAIN

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **pgvector Index EXPLAIN Review**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Repeatable EXPLAIN script
- [ ] 2. Before/after if index changed
- [ ] 3. Link to LAT-001
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **latency:** evidence-based pgvector plan
