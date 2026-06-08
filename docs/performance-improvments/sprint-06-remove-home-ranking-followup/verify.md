# Sprint-06 — Verification: Remove Home Ranking Follow-Up

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-6, FE-006
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Home load does not fetch ranking breakdown
2. Confidence indicator handles missing ranking
3. Observability page still loads ranking on demand

## Anti-objectives to check

1. Do not remove ranking from Observability pages
2. Do not break explainability API
3. Do not hide ranking-detected failures

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Remove Home Ranking Follow-Up**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Network tab: no /ranking on home
- [ ] 2. Observability still fetches ranking
- [ ] 3. No runtime errors on home
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **requests:** -1
- **payload:** -20 to -200 KB
