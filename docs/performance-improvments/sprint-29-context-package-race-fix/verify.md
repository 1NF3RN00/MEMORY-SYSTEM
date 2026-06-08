# Sprint-29 — Verification: Context Package Persistence Race Fix

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** PBUG-001
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Package persisted before completed status
2. Regression test
3. Clear incomplete error

## Anti-objectives to check

1. No schema change
2. No broken replay
3. No false success

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Context Package Persistence Race Fix**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Stress complete paths
- [ ] 2. Compression works after retrieve
- [ ] 3. Replay has package
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **stability:** no lost package on new runs
