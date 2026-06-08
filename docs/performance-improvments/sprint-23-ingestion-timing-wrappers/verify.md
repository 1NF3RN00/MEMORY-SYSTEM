# Sprint-23 — Verification: Ingestion Pipeline Timing Wrappers

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-22, MF-005
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. All ingestion stages in timingAudit
2. Worker emits timing.audit.completed
3. Legacy records preserved

## Anti-objectives to check

1. No ingestion output change
2. Keep Date.now() records
3. Minimal overhead

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Ingestion Pipeline Timing Wrappers**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Job log has timingAudit
- [ ] 2. Stage names match contract
- [ ] 3. Output identical
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **observability:** ingestion in unified audit
