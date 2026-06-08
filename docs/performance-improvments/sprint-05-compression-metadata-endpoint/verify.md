# Sprint-05 — Verification: Compression Metadata-Only Endpoint

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-5
- **Priority:** P0

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Home telemetry gets token counts and fidelity without context packages
2. Full trace detail still on compression traces page
3. Payload reduction measurable

## Anti-objectives to check

1. Do not strip fields needed by detail view
2. Do not change compression pipeline outputs
3. Do not break historian replay

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Compression Metadata-Only Endpoint**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Assert context packages absent in summary
- [ ] 2. Detail page still loads full trace
- [ ] 3. Document KB savings
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **payload:** remove multi-MB from home conditional fetch
