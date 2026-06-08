# Sprint-02 — Implementation: Workspace ID in AuthContext

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** OP-2, BUG-003
- **Priority:** P0
- **Estimated effort:** <1 day

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. AuthContext exposes workspaceId after auth resolves
2. ContextualIntelligenceMap and telemetry stop fetching /workspaces/default independently
3. Loading states remain correct

## Anti-objectives

1. Do not break unauthenticated flows
2. Do not fetch workspace before session valid
3. Do not duplicate workspace state in many contexts

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Expose resolved workspaceId from AuthContext; remove redundant GET /workspaces/default from child components.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Extend AuthContext with workspace + workspaceId
- [ ] 2. Update workspaceTelemetry to accept workspaceId param
- [ ] 3. Update ContextualIntelligenceMap to use useAuth().workspaceId
- [ ] 4. Remove duplicate fetch paths
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **requests:** -1 to -2 on home load
