# Sprint-15 — Verification: React Query for Telemetry

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-13, FE-003
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Cached telemetry with staleTime
2. Structural sharing reduces re-renders
3. StrictMode no double network

## Anti-objectives to check

1. Do not migrate entire dashboard
2. Document query keys
3. Surface errors

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **React Query for Telemetry**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. StrictMode single wire per key
- [ ] 2. refetchInterval for poll
- [ ] 3. Error states visible
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **rerenders:** structural sharing active
