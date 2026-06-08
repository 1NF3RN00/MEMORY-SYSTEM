# Sprint-02 — Verification: Workspace ID in AuthContext

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-2, BUG-003
- **Priority:** P0

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. AuthContext exposes workspaceId after auth resolves
2. ContextualIntelligenceMap and telemetry stop fetching /workspaces/default independently
3. Loading states remain correct

## Anti-objectives to check

1. Do not break unauthenticated flows
2. Do not fetch workspace before session valid
3. Do not duplicate workspace state in many contexts

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Workspace ID in AuthContext**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Network tab: at most one /workspaces/default on home load
- [ ] 2. Test workspace switch if applicable
- [ ] 3. Auth loading gate still blocks premature fetches
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **requests:** -1 to -2 on home load
