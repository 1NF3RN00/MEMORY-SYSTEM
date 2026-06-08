# Sprint-10 — Verification: React.memo Home Panels

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-9, FE-005
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Panels skip re-render when telemetry unchanged
2. Stable callback props
3. No visual regressions

## Anti-objectives to check

1. Do not cause stale UI with over-memoization
2. Do not break stream updates
3. Do not refactor HomePage layout

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **React.memo Home Panels**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. React Profiler: fewer commits on 15s poll
- [ ] 2. Stream updates when new events arrive
- [ ] 3. Document commit delta if measured
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **rerenders:** ~50% reduction on poll
