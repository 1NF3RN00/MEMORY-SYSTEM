# Sprint-21 — Verification: Verify API gzip/brotli Compression

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-20
- **Priority:** P2

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. Content-Encoding on large JSON
2. Config documented
3. Wire size measured

## Anti-objectives to check

1. Do not break SSE/binary
2. No CPU regression unmeasured

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Verify API gzip/brotli Compression**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. curl shows Content-Encoding gzip
- [ ] 2. Smaller transferred bytes
- [ ] 3. Health still fast
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **wire:** 60-80% on large JSON
