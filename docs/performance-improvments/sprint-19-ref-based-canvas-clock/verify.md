# Sprint-19 — Verification: Ref-Based Canvas Phase Label & Clock

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-18, FE-005
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Phase label without setState
2. Clock without parent re-render
3. Visual unchanged

## Anti-objectives to check

1. Do not break canvas
2. Keep timezone formatting
3. Clear intervals on unmount

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Ref-Based Canvas Phase Label & Clock**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. TopBar no 1s commits
- [ ] 2. Phase visible
- [ ] 3. Unmount cleanup
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **rerenders:** timer commits eliminated
