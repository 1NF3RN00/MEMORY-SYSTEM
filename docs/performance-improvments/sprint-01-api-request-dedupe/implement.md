# Sprint-01 — Implementation: API In-Flight Request Deduplication

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** OP-1, BUG-003, FE-001
- **Priority:** P0
- **Estimated effort:** <1 day

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. Identical concurrent apiGet URLs produce one HTTP request
2. Dedupe map clears entries on settle (success or error)
3. No change to response shapes

## Anti-objectives

1. Do not cache responses across navigations (in-flight only)
2. Do not dedupe POST/PUT/PATCH/DELETE
3. Do not change API server behavior

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Add in-flight deduplication to dashboard apiGet so identical concurrent GETs share one network call.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Add Map<url, Promise> in apps/dashboard/src/lib/api.ts
- [ ] 2. Wrap apiGet to reuse in-flight promise
- [ ] 3. Handle error propagation to all waiters
- [ ] 4. Document behavior in outcomes.md
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **requests:** -2 to -3 duplicate calls on home load
