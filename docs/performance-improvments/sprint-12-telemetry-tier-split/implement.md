# Sprint-12 — Implementation: Split Telemetry Summary vs Analytics

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** OP-8, FE-004, AR-001
- **Priority:** P1
- **Estimated effort:** 3-5 days

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. Home loads summary tier on mount
2. Analytics on Observability or panel expand
3. Tier boundaries documented

## Anti-objectives

1. Do not break Observability completeness
2. Do not duplicate logic unmaintainably
3. Do not break API contracts silently

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Split fetchWorkspaceTelemetry into summary and analytics tiers.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Define tiers per DASHBOARD_LOAD_AUDIT
- [ ] 2. Refactor workspaceTelemetry.ts
- [ ] 3. Gate analytics by route/panel
- [ ] 4. Update hooks
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **requests:** 12 → 4 on home
