# Sprint-17 — Implementation: pgvector Index EXPLAIN Review

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** OP-16, LAT-001, MF-001
- **Priority:** P2
- **Estimated effort:** 1 week

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. EXPLAIN captured for representative queries
2. Index usage documented
3. Recommendations evidence-based only

## Anti-objectives

1. No index change without measurement
2. No candidate limit changes
3. No fabricated EXPLAIN

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

EXPLAIN ANALYZE for pgvector queries; document tuning.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Benchmark script
- [ ] 2. EXPLAIN on vector SQL
- [ ] 3. Document in outcomes
- [ ] 4. Optional index if proven
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **latency:** evidence-based pgvector plan
