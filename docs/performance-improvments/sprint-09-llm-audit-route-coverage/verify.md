# Sprint-09 — Verification: LLM Audit Full Route Coverage

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** PBUG-002, OP-15
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. All OpenAI invocations record on instrumented routes
2. llmCallAudit or llm.audit.completed emitted
3. No silent recordLlmCall no-ops

## Anti-objectives to check

1. Do not double-wrap instrumented routes
2. Do not change LLM prompts or models
3. Do not block requests if collector missing

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **LLM Audit Full Route Coverage**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Each route: llmCallAudit.calls non-empty when LLM runs
- [ ] 2. Planning route still empty calls[]
- [ ] 3. Worker job still emits audit
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **coverage:** 100% instrumented routes
