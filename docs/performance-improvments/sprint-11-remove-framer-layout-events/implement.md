# Sprint-11 — Implementation: Remove Framer Layout on Event Cards

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** OP-10, FE-005
- **Priority:** P1
- **Estimated effort:** <1 day

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. No layout animations on poll updates
2. Enter/exit preserved if desired
3. Reduced main-thread work

## Anti-objectives

1. Do not remove all motion without UX note
2. Do not break stream accessibility
3. Do not change event ordering

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Remove layout prop from LiveOperationalStream event cards.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Set layout={false} or remove layout
- [ ] 2. Verify CSS transitions
- [ ] 3. Profile if possible
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **rerenders:** layout thrash eliminated on poll
