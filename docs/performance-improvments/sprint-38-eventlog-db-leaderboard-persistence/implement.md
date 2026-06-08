# Sprint-38 — Implementation: EventLog DB Leaderboard Persistence

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** AR-005
- **Priority:** P2
- **Estimated effort:** 3-5 days

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. ?source=history on diagnostics
2. Query EventLog by totalDbTime
3. Document vs in-memory

## Anti-objectives

1. Bounded query
2. No slow scan
3. No unnecessary migration

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Historical DB ops from EventLog survives cold start.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Historical query in diagnostics
- [ ] 2. Limit/pagination
- [ ] 3. Tests with fixtures
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **observability:** cross-restart leaderboard
