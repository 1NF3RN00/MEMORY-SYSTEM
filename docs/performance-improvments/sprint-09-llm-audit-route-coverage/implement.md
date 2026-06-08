# Sprint-09 — Implementation: LLM Audit Full Route Coverage

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** PBUG-002, OP-15
- **Priority:** P1
- **Estimated effort:** <1 day

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. All OpenAI invocations record on instrumented routes
2. llmCallAudit or llm.audit.completed emitted
3. No silent recordLlmCall no-ops

## Anti-objectives

1. Do not double-wrap instrumented routes
2. Do not change LLM prompts or models
3. Do not block requests if collector missing

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Wrap remaining LLM routes with runWithLlmCallAsync.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Audit all createOpenAi* call sites
- [ ] 2. Add runWithLlmCallAsync to uncovered routes
- [ ] 3. Document route inventory in outcomes
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **coverage:** 100% instrumented routes
