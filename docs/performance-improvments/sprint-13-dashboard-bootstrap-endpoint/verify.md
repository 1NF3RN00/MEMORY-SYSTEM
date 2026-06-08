# Sprint-13 — Verification: Dashboard Bootstrap Endpoint

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-11
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Single endpoint replaces parallel home bundle
2. Server batches DB reads
3. Typed response documented

## Anti-objectives to check

1. Do not return full trace bodies
2. Do not break existing list endpoints
3. Do not over-couple to one page

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Dashboard Bootstrap Endpoint**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Home ≤3 requests with bootstrap
- [ ] 2. Payload <300KB typical
- [ ] 3. Load test handler
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **requests:** 14-16 → 2-3
