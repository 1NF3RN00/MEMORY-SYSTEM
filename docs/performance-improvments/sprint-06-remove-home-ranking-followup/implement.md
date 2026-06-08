# Sprint-06 — Implementation: Remove Home Ranking Follow-Up

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** OP-6, FE-006
- **Priority:** P1
- **Estimated effort:** <1 day

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. Home load does not fetch ranking breakdown
2. Confidence indicator handles missing ranking
3. Observability page still loads ranking on demand

## Anti-objectives

1. Do not remove ranking from Observability pages
2. Do not break explainability API
3. Do not hide ranking-detected failures

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Remove GET /retrieval/:id/ranking from fetchWorkspaceTelemetry on home load.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Remove ranking follow-up in workspaceTelemetry.ts
- [ ] 2. Adjust confidence UI
- [ ] 3. Document behavior change
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **requests:** -1
- **payload:** -20 to -200 KB
