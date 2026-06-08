# Sprint-05 — Implementation: Compression Metadata-Only Endpoint

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** OP-5
- **Priority:** P0
- **Estimated effort:** 1-3 days

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. Home telemetry gets token counts and fidelity without context packages
2. Full trace detail still on compression traces page
3. Payload reduction measurable

## Anti-objectives

1. Do not strip fields needed by detail view
2. Do not change compression pipeline outputs
3. Do not break historian replay

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Add summary route or ?summary=true for compression traces; use in workspaceTelemetry.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Add getCompressionSummary or query flag
- [ ] 2. Expose route or extend list endpoint
- [ ] 3. Switch workspaceTelemetry conditional fetch
- [ ] 4. Measure payload before/after
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **payload:** remove multi-MB from home conditional fetch
