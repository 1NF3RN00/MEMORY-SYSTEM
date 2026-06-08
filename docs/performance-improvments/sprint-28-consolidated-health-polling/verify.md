# Sprint-28 — Verification: Consolidated Health Polling

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** BUG-003, FE-001
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. One /health per cycle
2. SystemBar uses shared source
3. Interval preserved

## Anti-objectives to check

1. No stale health forever
2. UI not blocked on failure

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Consolidated Health Polling**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. One /health per cycle
- [ ] 2. Bar shows status
- [ ] 3. Errors propagate
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **requests:** -1 duplicate health
