# Sprint-26 — Verification: EXPLAIN ANALYZE Automation

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-25
- **Priority:** P3

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Slow queries trigger EXPLAIN when flagged
2. Output in logs/diagnostics
3. Opt-in env

## Anti-objectives to check

1. No EXPLAIN on writes by default
2. No PII in stored plans
3. Low overhead

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **EXPLAIN ANALYZE Automation**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Synthetic slow triggers EXPLAIN
- [ ] 2. Disabled by default
- [ ] 3. No regression
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **observability:** automated plan capture
