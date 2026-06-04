# Domain Engine — Implementation Reference

This folder is the **authoritative build guide** for the Domain Engine and Package System. Use it when implementing or reviewing any domain-related work.

## Documents

| Document | Purpose |
|----------|---------|
| [IMPLEMENTATION_INSTRUCTIONS.md](./IMPLEMENTATION_INSTRUCTIONS.md) | Locked decisions, phase order, agent rules, integration points |
| [CONTRACTS.md](./CONTRACTS.md) | TypeScript contracts and Prisma model spec (Phase 1 target) |
| [RBAC.md](./RBAC.md) | Role matrix and route permission rules |
| [API_SURFACE.md](./API_SURFACE.md) | HTTP routes, request shapes, event types |

## Related architecture

- [DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md](../DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md) — product/architecture spec
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
| 7 | Dashboard managers | Not started |

Update the **Build status** table when a phase completes.

## Hard rules (never violate)

1. Middleware stays domain-agnostic — no SEO/Competitor/Inbox/Strategy in retrieval/compression core.
2. Fact precedence: Global Facts → Domain Facts → Instructions → Retrieved Context.
3. Facts **replace** conflicting chunk text; replacements must appear in admin-visible traces.
4. Domains are optional add-ons — workspace works as memory-only with no domains installed.
5. `domainKey` + `domainAction` on API calls; omit both for workspace-wide retrieval.
