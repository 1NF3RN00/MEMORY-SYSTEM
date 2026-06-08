# Sprint-27 — Verification: Slim Operational Diagnostics API

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** RC-004
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Counts without full result JSON
2. Full mode for historian
3. Dashboard uses slim

## Anti-objectives to check

1. Historian deep analysis intact
2. Keep failedStage info
3. Same diagnostic logic

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Slim Operational Diagnostics API**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Slim <10KB typical
- [ ] 2. Counts match full
- [ ] 3. Historian full mode OK
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **payload:** major diagnostics reduction
