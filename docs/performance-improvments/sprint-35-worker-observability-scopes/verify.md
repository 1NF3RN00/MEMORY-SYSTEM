# Sprint-35 — Verification: Worker Job Observability Scopes

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** AR-004
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Worker emits timing and llm audits
2. DB scope when sprint-07 landed
3. traceId correlates

## Anti-objectives to check

1. Same traceId scheme
2. Audit fail non-blocking
3. Separate processes OK

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Worker Job Observability Scopes**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Job log full audit
- [ ] 2. traceId matches API
- [ ] 3. Failed job partial audit
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **observability:** ingestion job audit
