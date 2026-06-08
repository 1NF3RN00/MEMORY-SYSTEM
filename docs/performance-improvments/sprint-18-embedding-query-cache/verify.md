# Sprint-18 — Verification: Embedding Query Cache

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-17, LAT-002
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Identical query skips OpenAI on hit
2. Invalidation documented
3. Reduced embed stage on hit

## Anti-objectives to check

1. Workspace isolation
2. No wrong embedding on collision
3. Deterministic retrieval preserved

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Embedding Query Cache**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Second identical retrieve faster
- [ ] 2. Miss still calls OpenAI
- [ ] 3. Isolation test
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **latency:** embed ~0ms on hit
