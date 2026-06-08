# Sprint-18 — Implementation: Embedding Query Cache

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **implementation agent** for this sprint pair. Ship the scoped change, achieve objectives, and document how anti-objectives were avoided in `outcomes.md`.

## Audit mapping

- **Finding / opportunity IDs:** OP-17, LAT-002
- **Priority:** P2
- **Estimated effort:** 1 week

## References

- `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/performance-improvments/GLOBAL_PROMPT.md`
- `docs/performance-improvments/README.md`

## Objectives

1. Identical query skips OpenAI on hit
2. Invalidation documented
3. Reduced embed stage on hit

## Anti-objectives

1. Workspace isolation
2. No wrong embedding on collision
3. Deterministic retrieval preserved

*Also obey all global anti-objectives GA-1 through GA-7 in GLOBAL_PROMPT.md.*

## Scope

Cache embeddings by normalized query hash.

**Out of scope:** Anything not required to meet the objectives above; other performance sprints; algorithm changes unless explicitly listed.

## Task list

- [ ] 1. Cache key: workspaceId + normalized query
- [ ] 2. LRU/TTL at embed wrapper
- [ ] 3. Record cache hit
- [ ] 4. Tests
- [ ] Update `outcomes.md` — Implementation summary
- [ ] Update `outcomes.md` — Anti-objectives avoided (explain each)

## Definition of done

- [ ] All in-scope tasks complete or explicitly blocked with reason
- [ ] Objectives met with concrete evidence (code, logs, or measurements)
- [ ] `outcomes.md` updated by implementation agent
- [ ] No anti-objectives violated

## Target metrics

- **latency:** embed ~0ms on hit
