# Performance sprint run — sprint-02-workspace-id-auth-context — verify

You are executing a structured performance improvement sprint in the semantic-core monorepo.

## Mandatory reading (follow exactly)

### GLOBAL_PROMPT.md
# Performance Improvements — Global Prompt

Use this document as the **mandatory preamble** for every performance-improvement sprint pair (`implement.md` and `verify.md`). Read it fully before starting any sprint.

---

## Program Context

This program implements findings from **System Performance Audit V1** (`docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md`) and its structured companion (`docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`).

The middleware is **deterministic contextual memory infrastructure** — not a chatbot framework. Performance work must preserve:

- deterministic retrieval and ranking
- explainable trace/replay behavior
- operational observability (`traceId` correlation)
- retrieval precision per token as the primary product objective

---

## Sprint Pair Model

Every improvement is delivered as a **sprint pair** in `docs/performance-improvments/sprint-XX-<slug>/`:

| File | Role | Agent responsibility |
|------|------|----------------------|
| `implement.md` | **Implementation sprint** | Ship the scoped change; meet objectives; document how anti-objectives were avoided |
| `verify.md` | **Verification sprint** | Build/run tests; measure outcomes; score implementation; flag anti-objective violations |
| `outcomes.md` | **Shared ledger** | **Both sprints edit this file.** Implementation records what was done; verification records evidence and scores |

### Implementation sprint MUST

1. Complete every task in scope (or explicitly mark blocked items in `outcomes.md`).
2. Achieve all listed **objectives** with evidence.
3. Add an **Anti-Objectives Avoided** section to `outcomes.md` explaining how each anti-objective was prevented.
4. Not expand scope beyond the sprint folder's defined boundaries.

### Verification sprint MUST

1. Create or extend a **testing framework** appropriate to the sprint (unit, integration, manual checklist, HAR capture, benchmark script, etc.).
2. **Document findings** in `outcomes.md` under a `Verification` section.
3. State whether each **objective was met** (yes/no/partial + evidence).
4. State whether any **anti-objectives were violated** (yes/no + evidence).
5. **Score the work** 0–100 using the rubric below.
6. List **places for improvement** if score < 100 or objectives partial.

---

## Scoring Rubric (Verification)

| Dimension | Weight | 0 | 50 | 100 |
|-----------|--------|---|----|----|
| Objectives met | 40% | None met | Partial | All met with evidence |
| Anti-objectives clean | 25% | Violations shipped | Minor risk | No violations |
| Test coverage | 20% | No tests | Some paths | Objectives covered by automated or repeatable manual tests |
| Regression safety | 15% | Outputs changed | Minor drift | Retrieval/compression outputs identical or explicitly approved |

**Overall score** = weighted sum. Record in `outcomes.md` as:

```markdown
## Verification Score
- **Score:** NN / 100
- **Objectives met:** X/Y
- **Anti-objectives violated:** none | list
```

---

## Global Objectives (All Sprints)

- Reduce measurable waste (latency, bytes, query count, re-renders) without harming retrieval correctness.
- Prefer instrumentation and slim APIs over algorithm changes unless the sprint explicitly authorizes algorithm work.
- Correlate all new observability to existing `traceId` / ULID patterns.
- Leave `outcomes.md` in a state the next engineer can trust without reading chat history.

---

## Global Anti-Objectives (All Sprints)

| ID | Anti-objective | Why |
|----|----------------|-----|
| GA-1 | Changing retrieval ranking, thresholds, or stage ordering without explicit sprint authorization | Violates determinism mandate |
| GA-2 | Introducing autonomous agents, ML heuristics, or non-deterministic tuning | Out of V1 scope |
| GA-3 | Breaking backward compatibility of trace payloads the dashboard consumes | Operational regressions |
| GA-4 | Fabricating performance numbers | Audit integrity |
| GA-5 | Scope creep into unrelated refactors | Sprint discipline |
| GA-6 | Removing existing `stages[]` or trace fields without migration plan | Dashboard/historian dependency |
| GA-7 | Adding new database tables when JSON/EventLog suffices (unless sprint authorizes) | Architecture simplicity |

---

## Reference Points

### Audit & planning

| Document | Path |
|----------|------|
| System Performance Audit V1 | `docs/PERFORMANCE-AUDITS/SYSTEM_PERFORMANCE_AUDIT_V1.md` |
| Structured findings JSON | `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json` |
| Dashboard load audit | `docs/PERFORMANCE-AUDITS/DASHBOARD_LOAD_AUDIT.md` |
| Execution timing audit | `docs/PERFORMANCE-AUDITS/EXECUTION_TIMING_AUDIT_SYSTEM.md` |
| LLM call audit | `docs/PERFORMANCE-AUDITS/LLM_CALL_AUDIT.md` |
| DB observability plan | `docs/PERFORMANCE-AUDITS/DATABASE_QUERY_OBSERVABILITY.md` |
| Sprint index | `docs/performance-improvments/README.md` |

### Architecture & conventions

| Document | Path |
|----------|------|
| Global architecture prompt | `docs/GLOBAL_ARCHITECTURE_PROMPT.md` |
| Retrieval architecture | `docs/RETRIEVAL_ARCHITECTURE.md` |
| Compression architecture | `docs/COMPRESSION_ARCHITECTURE.md` |
| Performance testing | `docs/testing/performance-testing.md` |

### Code hotspots (from audit)

| Area | Path |
|------|------|
| Dashboard API client | `apps/dashboard/src/lib/api.ts` |
| Workspace telemetry | `apps/dashboard/src/lib/workspaceTelemetry.ts` |
| Auth context | `apps/dashboard/src/context/AuthContext.tsx` |
| Operational diagnostics | `apps/api/src/routes/historian.ts` |
| Relationship graph | `apps/api/src/lib/relationship-graph-store.ts` |
| Prisma bootstrap | `apps/api/src/lib/database.ts` |
| Retrieval routes | `apps/api/src/routes/retrieval.ts` |
| Observability package | `packages/observability/` |
| Retrieval pipeline | `packages/retrieval/src/pipeline.ts` |

---

## `outcomes.md` Template (Both Sprints Use)

```markdown
# Sprint-XX Outcomes — <Title>

## Status
- Implementation: not started | in progress | complete | blocked
- Verification: not started | in progress | complete

## Audit mapping
- Finding IDs: ...
- Opportunity rank(s): ...

## Implementation summary
<!-- Implementation sprint fills this -->

## Anti-objectives avoided
<!-- Implementation sprint: how each sprint + global anti-objective was avoided -->

## Verification summary
<!-- Verification sprint fills this -->

## Verification Score
- **Score:** — / 100
- **Objectives met:** —/—
- **Anti-objectives violated:** —

## Measurements
| Metric | Before | After | Target | Evidence |
|--------|--------|-------|--------|----------|

## Places for improvement
<!-- Verification sprint -->
```

---

## Execution Order

Sprints are numbered for dependency convenience. See `README.md` for:

- recommended sequence
- parallelizable groups
- audit ID → sprint mapping

When in doubt, ship **measurement sprints (31–32)** after quick wins so later sprints have baselines.


---

### Sprint prompt (verify.md)
# Sprint-02 — Verification: Workspace ID in AuthContext

> **Read first:** [`GLOBAL_PROMPT.md`](../GLOBAL_PROMPT.md)

## Role

You are the **verification agent** for this sprint pair. Build or run the testing framework, document findings in `outcomes.md`, score the implementation, and list improvements.

**Prerequisite:** Implementation sprint complete or explicitly ready for verification.

## Audit mapping

- **Finding / opportunity IDs:** OP-2, BUG-003
- **Priority:** P0

## References

- `implement.md` (same folder) — expected behavior
- `outcomes.md` (same folder) — implementation claims to verify
- `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
- `docs/testing/performance-testing.md`

## Objectives to verify

1. AuthContext exposes workspaceId after auth resolves
2. ContextualIntelligenceMap and telemetry stop fetching /workspaces/default independently
3. Loading states remain correct

## Anti-objectives to check

1. Do not break unauthenticated flows
2. Do not fetch workspace before session valid
3. Do not duplicate workspace state in many contexts

*Verify all global anti-objectives GA-1 through GA-7.*

## Scope

Verification only for: **Workspace ID in AuthContext**. Do not re-implement unless tests expose a defect.

## Testing framework

- [ ] 1. Network tab: at most one /workspaces/default on home load
- [ ] 2. Test workspace switch if applicable
- [ ] 3. Auth loading gate still blocks premature fetches
- [ ] Record measurements in `outcomes.md` — Measurements table
- [ ] Score 0–100 per GLOBAL_PROMPT rubric
- [ ] List places for improvement if score < 100

## Verification checklist

- [ ] Each objective: **met / partial / not met** with evidence
- [ ] Each anti-objective: **violated yes/no** with evidence
- [ ] Regression: retrieval/compression outputs unchanged unless sprint allowed
- [ ] `outcomes.md` Verification section complete

## Target metrics

- **requests:** -1 to -2 on home load


---

## Execution rules

1. Work only within this sprint's scope.
2. Edit `C:/Users/james/semantic-core/docs/performance-improvments/sprint-02-workspace-id-auth-context/outcomes.md` as you go (Verification summary + Score + Measurements).
3. Run tests relevant to this sprint before finishing.
4. Do not start other sprints.
5. If blocked, document the blocker in outcomes.md and stop.

## Repo root
C:/Users/james/semantic-core

Begin now.
