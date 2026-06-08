# Sprint-20 — Verification: Single Mobile/Desktop Panel Instance

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-19, FE-005
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. One stream + one panels in tree
2. Responsive CSS
3. Same subscriptions

## Anti-objectives to check

1. Mobile/desktop layouts intact
2. No duplicate poll hooks

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Single Mobile/Desktop Panel Instance**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. One instance each in tree
- [ ] 2. Mobile/desktop QA
- [ ] 3. No double subscription
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **tree:** 2x → 1x instances
