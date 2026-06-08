# Sprint-33 — Verification: Unified Observability Dashboard

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** long-term
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. All three audits on trace detail
2. Link from list
3. Read-only

## Anti-objectives to check

1. No unnecessary duplication
2. No new tables
3. Graceful missing db on old traces

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Unified Observability Dashboard**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. All audits when present
- [ ] 2. Partial data OK
- [ ] 3. UX review
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **dx:** one pane all audits
