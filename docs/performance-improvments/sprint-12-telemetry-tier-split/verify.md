# Sprint-12 — Verification: Split Telemetry Summary vs Analytics

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-8, FE-004, AR-001
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Home loads summary tier on mount
2. Analytics on Observability or panel expand
3. Tier boundaries documented

## Anti-objectives to check

1. Do not break Observability completeness
2. Do not duplicate logic unmaintainably
3. Do not break API contracts silently

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Split Telemetry Summary vs Analytics**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Home request count drops
- [ ] 2. Observability shows full analytics
- [ ] 3. Document tier mapping
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **requests:** 12 → 4 on home
