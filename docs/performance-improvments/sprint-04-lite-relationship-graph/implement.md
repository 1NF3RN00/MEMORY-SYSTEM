# Sprint-04 — Implementation: Lite Relationship Graph Endpoint

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** BUG-002, OP-4
- **Priority:** P0
- **Estimated effort:** 1-3 days

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. lite=true omits timeline, retrievalTraces, heatmap embeds
2. ContextualIntelligenceMap uses lite endpoint
3. Full graph endpoint unchanged when lite absent

## Anti-objectives

1. Do not break Relationship Map page needing full graph
2. Do not change node/edge ID schema
3. Do not reduce precision of full map page

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Add GET /relationships/graph?lite=true returning nodes and edges only; switch home map to lite mode.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Add lite branch in relationship-graph-store.ts
- [ ] 2. Add query param in relationships route
- [ ] 3. Update ContextualIntelligenceMap fetch URL
- [ ] 4. Document payload size delta in outcomes
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **payload:** 50-80% graph reduction on home
