# Sprint-31 — Verification: Production Retrieval Latency Baseline

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** MF-006, LAT-009
- **Priority:** P0

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Benchmark script
2. Percentiles in outcomes
3. Stage aggregates
4. Compare to mock 27.54ms

## Anti-objectives to check

1. No fabricated numbers
2. No prod without approval
3. Fixed config during run

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Production Retrieval Latency Baseline**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Repeatable script
- [ ] 2. Results in outcomes
- [ ] 3. Optional JSON artifact
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **evidence:** real p95 for retrieve
