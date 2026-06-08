# Sprint-24 — Verification: Dashboard timingAudit Display

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-23
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Hrtime stages in UI
2. Fallback to legacy stages[]
3. No new page

## Anti-objectives to check

1. Do not break timeline
2. No extra fetches
3. Correct hierarchy labels

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Dashboard timingAudit Display**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. timingAudit renders
- [ ] 2. Legacy trace works
- [ ] 3. Visual QA
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **dx:** hrtime visible in dashboard
