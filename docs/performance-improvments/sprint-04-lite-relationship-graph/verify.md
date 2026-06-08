# Sprint-04 — Verification: Lite Relationship Graph Endpoint

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** BUG-002, OP-4
- **Priority:** P0

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. lite=true omits timeline, retrievalTraces, heatmap embeds
2. ContextualIntelligenceMap uses lite endpoint
3. Full graph endpoint unchanged when lite absent

## Anti-objectives to check

1. Do not break Relationship Map page needing full graph
2. Do not change node/edge ID schema
3. Do not reduce precision of full map page

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Lite Relationship Graph Endpoint**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Compare response bytes full vs lite
- [ ] 2. Assert required node/edge fields for map
- [ ] 3. Regression test full graph route
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **payload:** 50-80% graph reduction on home
