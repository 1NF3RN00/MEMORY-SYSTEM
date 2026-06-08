# Sprint Pair Format

Every performance improvement from **System Performance Audit V1** is broken into a **sprint pair**: one implementation prompt and one verification prompt, sharing a single outcomes ledger.

---

## Folder layout

```
docs/performance-improvments/
├── GLOBAL_PROMPT.md          ← read before any sprint
├── README.md                 ← index + execution waves
├── SPRINT_PAIR_FORMAT.md     ← this file
└── sprint-XX-<slug>/
    ├── implement.md          ← implementation agent prompt
    ├── verify.md             ← verification agent prompt
    └── outcomes.md           ← both agents edit
```

---

## Implementation pair (`implement.md`)

The model acting as implementer MUST:

1. **Do the job** — complete the scoped task list.
2. **Achieve objectives** — every numbered objective met or explicitly blocked.
3. **Explain anti-objective avoidance** — fill `outcomes.md` → Anti-objectives avoided with evidence per row.

Required sections in every `implement.md`:

| Section | Content |
|---------|---------|
| Role | Implementation agent |
| Audit mapping | Finding IDs, priority, effort |
| References | Audit docs + GLOBAL_PROMPT |
| Objectives | Numbered success criteria |
| Anti-objectives | Numbered guardrails + GA-1..GA-7 |
| Scope | In / out boundaries |
| Task list | Checkbox tasks + outcomes updates |
| Definition of done | Completion gates |
| Target metrics | Expected measurable deltas |

---

## Verification pair (`verify.md`)

The model acting as verifier MUST:

1. **Create a testing framework** — unit, integration, manual checklist, benchmark, HAR, or Profiler as appropriate.
2. **Document findings** in `outcomes.md` → Verification summary.
3. **Identify objective compliance** — met / partial / not met per objective with evidence.
4. **Identify anti-objective violations** — yes/no per anti-objective.
5. **Score the work** 0–100 using GLOBAL_PROMPT rubric.
6. **Provide improvement places** when score < 100 or objectives partial.

Required sections in every `verify.md`:

| Section | Content |
|---------|---------|
| Role | Verification agent |
| Prerequisite | Implementation complete |
| Objectives to verify | Same as implement |
| Anti-objectives to check | Same as implement |
| Testing framework | Checkbox verification tasks |
| Verification checklist | Regression + outcomes completeness |
| Target metrics | Same targets as implement |

---

## Shared outcomes (`outcomes.md`)

Both sprint pairs edit the same file:

| Section | Written by |
|---------|------------|
| Status | Both (update flags) |
| Implementation summary | Implementer |
| Anti-objectives avoided | Implementer |
| Verification summary | Verifier |
| Objective results table | Verifier |
| Anti-objective results table | Verifier |
| Verification Score | Verifier |
| Measurements | Both (before/after) |
| Places for improvement | Verifier |

---

## Scoring (verification)

See `GLOBAL_PROMPT.md` for full rubric:

- Objectives met — 40%
- Anti-objectives clean — 25%
- Test coverage — 20%
- Regression safety — 15%

---

## Naming convention

`sprint-XX-<slug>` where:

- `XX` = two-digit order (01–39)
- `<slug>` = kebab-case short name

Example: `sprint-03-operational-diagnostics-n-plus-one`

---

## Prompt invocation

**Implementation run:**

```
Read docs/performance-improvments/GLOBAL_PROMPT.md
Then execute docs/performance-improvments/sprint-03-operational-diagnostics-n-plus-one/implement.md
Update outcomes.md as you go.
```

**Verification run:**

```
Read docs/performance-improvments/GLOBAL_PROMPT.md
Then execute docs/performance-improvments/sprint-03-operational-diagnostics-n-plus-one/verify.md
Score implementation using outcomes.md implementation claims.
```
