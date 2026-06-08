# Sprint-39 — Verification: Context Delivery Timing Wrappers

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** EXECUTION_TIMING
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. context_rendering in timingAudit
2. fact_precedence visible
3. Legacy preserved

## Anti-objectives to check

1. No output change
2. Fact precedence intact

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Context Delivery Timing Wrappers**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Render returns stages
- [ ] 2. Byte-identical output
- [ ] 3. Order correct
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **observability:** delivery timed
