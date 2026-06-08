# Sprint-22 — Verification: List Endpoint Field Projection

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-21
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. fields limits columns
2. Default unchanged
3. Dashboard uses where safe

## Anti-objectives to check

1. Full rows by default
2. No internal field leak
3. Safe parsing

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **List Endpoint Field Projection**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Projected smaller than default
- [ ] 2. Invalid fields rejected
- [ ] 3. Detail unchanged
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **payload:** 30-50% on memory list
