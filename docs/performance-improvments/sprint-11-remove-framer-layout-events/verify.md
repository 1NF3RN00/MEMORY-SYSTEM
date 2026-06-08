# Sprint-11 — Verification: Remove Framer Layout on Event Cards

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-10, FE-005
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. No layout animations on poll updates
2. Enter/exit preserved if desired
3. Reduced main-thread work

## Anti-objectives to check

1. Do not remove all motion without UX note
2. Do not break stream accessibility
3. Do not change event ordering

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Remove Framer Layout on Event Cards**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Profiler: fewer layout recalcs on poll
- [ ] 2. Visual check enter/exit
- [ ] 3. No scroll jank
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **rerenders:** layout thrash eliminated on poll
