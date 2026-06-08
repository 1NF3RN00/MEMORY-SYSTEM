---
name: performance-sprint-program
description: >-
  Create performance-improvement sprint pairs (implement + verify + outcomes.md)
  from audit findings, following docs/performance-improvments format. Use when
  the user wants new sprints, waves, GLOBAL_PROMPT updates, or to break an audit
  into structured agent-ready work units like the performance improvments program.
disable-model-invocation: true
---

# Performance Sprint Program

Scaffold **sprint pairs** from audits using the format in `docs/performance-improvments/`.

## Sprint pair structure

Each sprint folder:

```
docs/performance-improvments/sprint-XX-<slug>/
├── implement.md   # build; meet objectives; avoid anti-objectives
├── verify.md      # test; score; document violations
└── outcomes.md    # shared ledger (both agents edit)
```

Global docs:

- `GLOBAL_PROMPT.md` — mandatory preamble for every pair
- `README.md` — wave index and execution order
- `SPRINT_PAIR_FORMAT.md` — format spec

## Creating a new sprint

1. Pick next `XX` and kebab `slug`
2. Map to audit IDs from `docs/PERFORMANCE-AUDITS/PERFORMANCE_FINDINGS.json`
3. Copy structure from an existing sprint (e.g. `sprint-03-operational-diagnostics-n-plus-one`)
4. Fill required sections in **both** `implement.md` and `verify.md`:
   - References
   - Objectives (numbered)
   - Anti-objectives (numbered)
   - Scope (in/out)
   - Task list (checkboxes)
5. Initialize `outcomes.md` from template in `GLOBAL_PROMPT.md`
6. Add row to `README.md` catalog and appropriate **wave** in `scripts/performance-sprints/run-wave.mjs` `WAVES` map

## Creating a new wave

1. Group sprints by dependency and ROI
2. Add `### Wave N` section in `README.md`
3. Add entry to `WAVES` in:
   - `scripts/performance-sprints/run-wave.mjs`
   - `scripts/performance-sprints/collect-wave-outcomes.mjs`

## Breaking an audit into sprints

One sprint per **distinct deliverable** (not per paragraph):

| Audit item type | Sprint scope |
|-----------------|--------------|
| Confirmed bug | Fix + regression test |
| Top opportunity | Implementation + measurement |
| Observability gap | Instrument + verify payload |
| Measurement gap | Harness + baseline capture |
| Long-term architecture | Spike or design-only sprint |

Pair every implementation sprint with verification — never ship implement-only in the program.

## Anti-objectives (always include)

Copy global GA-1..GA-7 from `GLOBAL_PROMPT.md` plus sprint-specific guards:

- No retrieval algorithm changes (unless sprint authorizes)
- No fabricated metrics
- No scope creep

## SDK integration

After sprints exist:

```bash
npm run perf:wave -- --wave <N>
```

See **remote-auto-dev** skill for email + remote triggers.

## Checklist before marking program updated

- [ ] Every new sprint has implement + verify + outcomes
- [ ] README catalog row added
- [ ] WAVES map updated in both scripts
- [ ] Audit ID referenced in implement.md audit mapping
