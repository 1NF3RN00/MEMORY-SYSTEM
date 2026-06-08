# Sprint-37 — Verification: Parallel BM25 Keyword Channel (V2)

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** AR-003
- **Priority:** P3

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Prototype behind flag
2. Merge documented
3. Default off

## Anti-objectives to check

1. GA-1: default off
2. V1 path unchanged
3. Retrieval tests required

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Parallel BM25 Keyword Channel (V2)**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. V1 unchanged flag off
- [ ] 2. Default tests pass
- [ ] 3. Report if prototype
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **architecture:** V2 lexical evaluated
