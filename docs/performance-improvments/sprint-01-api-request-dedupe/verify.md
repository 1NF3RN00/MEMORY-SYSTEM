# Sprint-01 — Verification: API In-Flight Request Deduplication

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-1, BUG-003, FE-001
- **Priority:** P0

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Identical concurrent apiGet URLs produce one HTTP request
2. Dedupe map clears entries on settle (success or error)
3. No change to response shapes

## Anti-objectives to check

1. Do not cache responses across navigations (in-flight only)
2. Do not dedupe POST/PUT/PATCH/DELETE
3. Do not change API server behavior

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **API In-Flight Request Deduplication**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Unit test: parallel apiGet same URL → one fetch mock
- [ ] 2. Manual: StrictMode double-mount shows single wire request in Network tab
- [ ] 3. Confirm failed requests do not poison cache
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **requests:** -2 to -3 duplicate calls on home load
