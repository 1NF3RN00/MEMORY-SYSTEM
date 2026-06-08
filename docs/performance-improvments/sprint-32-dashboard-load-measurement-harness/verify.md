# Sprint-32 — Verification: Dashboard Load Measurement Harness

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** FE-002, DASHBOARD_LOAD_AUDIT
- **Priority:** P0

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Documented procedure
2. Baseline captured
3. Optional Playwright HAR

## Anti-objectives to check

1. No secrets in HAR
2. Note StrictMode vs prod
3. No fabricated data

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Dashboard Load Measurement Harness**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Reproducible by second engineer
- [ ] 2. Before/after template
- [ ] 3. In outcomes.md
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **evidence:** measured dashboard load
