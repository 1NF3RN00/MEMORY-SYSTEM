# Sprint-14 — Verification: Shared WorkspaceTelemetryProvider

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-12, AR-001
- **Priority:** P1

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. One telemetry fetch shared
2. Single poll manager
3. Slice subscriptions

## Anti-objectives to check

1. No circular provider deps
2. No over-fetch on subset routes
3. Auth gating preserved

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Shared WorkspaceTelemetryProvider**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Single poll for app shell
- [ ] 2. Nav does not double-fetch
- [ ] 3. Network evidence
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **requests:** eliminate duplicate sidebar/home fetches
