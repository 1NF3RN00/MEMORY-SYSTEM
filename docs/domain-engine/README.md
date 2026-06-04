# Domain Engine — Implementation Reference

This folder is the **authoritative build guide** for the Domain Engine and Package System. Use it when implementing or reviewing any domain-related work.

## Documents

| Document | Purpose |
|----------|---------|
| [CREATE_DOMAINS_AND_PACKAGES.md](./CREATE_DOMAINS_AND_PACKAGES.md) | **Operator guide** — how to create domains, facts, instructions, and packages (dashboard + API) |
| [IMPLEMENTATION_INSTRUCTIONS.md](./IMPLEMENTATION_INSTRUCTIONS.md) | Locked decisions, phase order, agent rules, integration points |
| [CONTRACTS.md](./CONTRACTS.md) | TypeScript contracts and Prisma model spec (Phase 1–7 done; Phase 8+ planned) |
| [RBAC.md](./RBAC.md) | Role matrix and route permission rules |
| [API_SURFACE.md](./API_SURFACE.md) | HTTP routes, request shapes, event types |

## Related architecture

- [DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md](../DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md) — product/architecture spec (domains retrieve)
- [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](../WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md) — workflows, objects, extended precedence
- [RETRIEVAL_ARCHITECTURE.md](../RETRIEVAL_ARCHITECTURE.md) — middleware retrieval (domain-agnostic)
- [GLOBAL_ARCHITECTURE_PROMPT.md](../GLOBAL_ARCHITECTURE_PROMPT.md) — V1 constraints
- [OPERATIONAL_HISTORIAN_REPLAY_SYSTEM.md](../OPERATIONAL_HISTORIAN_REPLAY_SYSTEM.md) — replay requirements

## Build status

| Phase | Description | Status |
|-------|-------------|--------|
| 0 | Documentation (this folder) | **Done** |
| 1 | Contracts + Prisma schema | **Done** |
| 2 | `@memory-middleware/domain-engine` package | **Done** |
| 3 | Retrieval integration | **Done** |
| 4 | Context-delivery + fact override traces | **Done** |
| 5 | Package engine (install/export/clone/update) | **Done** |
| 6 | RBAC on new routes | **Done** |
| 7 | Dashboard managers (domains, facts, instructions, packages) | **Done** |
| 8 | Operational objects (contracts, schema, API, dashboard) | **Done** |
| 9 | Workflow registry + execution context resolver | **Done** |
| 10 | Workflow execution, runs, observability events | **Done** |
| 11 | Dashboard workflow managers + replay integration | **Done** |

Update the **Build status** table when a phase completes.

## Hard rules (never violate)

1. Middleware stays domain-agnostic — no SEO/Competitor/Inbox/Strategy in retrieval/compression core.
2. **Domain retrieval** precedence: Global Facts → Domain Facts → Instructions → Retrieved Context.
3. **Workflow execution** precedence extends (2) with Operational Objects → Previous Workflow Runs — see [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](../WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md).
4. Facts **replace** conflicting chunk text; replacements must appear in admin-visible traces.
5. Domains are optional add-ons — workspace works as memory-only with no domains installed.
6. Domains retrieve; workflows execute. Packages bundle retrieval — no execution logic.
7. `domainKey` + `domainAction` on API calls; omit both for workspace-wide retrieval.
8. Workflows never maintain hidden state — persistence only through facts, memories, objects, and workflow runs.
