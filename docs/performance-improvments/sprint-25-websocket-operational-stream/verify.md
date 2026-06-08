# Sprint-25 — Verification: WebSocket Operational Stream

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-24, FE-003
- **Priority:** P3

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Events without full refetch
2. Poll fallback on disconnect
3. Auth on WS

## Anti-objectives to check

1. No cross-tenant leak
2. No silent drops
3. V1 infra constraints

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **WebSocket Operational Stream**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Event without poll
- [ ] 2. Reconnect works
- [ ] 3. Load test connections
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **poll:** reduce 15s full bundle
