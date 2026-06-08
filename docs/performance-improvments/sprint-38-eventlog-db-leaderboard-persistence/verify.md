# Sprint-38 — Verification: EventLog DB Leaderboard Persistence

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** AR-005
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. ?source=history on diagnostics
2. Query EventLog by totalDbTime
3. Document vs in-memory

## Anti-objectives to check

1. Bounded query
2. No slow scan
3. No unnecessary migration

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **EventLog DB Leaderboard Persistence**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Works after restart
- [ ] 2. Matches in-memory window
- [ ] 3. Acceptable perf
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **observability:** cross-restart leaderboard
