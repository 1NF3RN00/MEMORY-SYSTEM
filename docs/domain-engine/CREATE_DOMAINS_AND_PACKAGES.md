# Creating Domains and Packages — Operator Guide

This guide explains how to **design, create, install, and maintain** domains and packages in a workspace. It is written for workspace admins and platform operators using the dashboard or API.

For HTTP route reference, see [API_SURFACE.md](./API_SURFACE.md). For type shapes, see [CONTRACTS.md](./CONTRACTS.md). For product architecture, see [DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md](../DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md). For workflows and operational objects, see [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](../WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md).

---

## What you are building

| Concept | What it is | When to use it |
|---------|------------|----------------|
| **Workspace** | One client / intelligence environment | Already exists after provisioning |
| **Operational object** | Metadata-driven entity (customer, competitor, campaign, …) | Organize real-world things; augment retrieval — not a memory |
| **Global fact** | Truth for the whole workspace (service area, policy) | Always wins over domain facts and retrieved text |
| **Domain** | Task-scoped retrieval operator | SEO audit, inbox triage, competitor scan — each is a **domain**, not a “category” |
| **Domain fact** | Truth that applies only inside one domain | Target keyword, escalation rule |
| **Instruction** | Versioned behavior for `domainKey` + `actionKey` | “How to run an audit” vs “how to write a report” |
| **Package** | Installable bundle of domains + facts + instructions | Reuse the same retrieval setup across workspaces — no execution logic |
| **Workflow** | Executable intelligence process | Consumes domains/packages/objects; produces outputs and workflow runs — see workflow spec |

**Middleware stays domain-agnostic.** You never hardcode “SEO” in retrieval core code. You express SEO (or anything else) as domain configuration and optional packages.

---

## Mental model

```txt
Workspace
├── Operational objects   (organize entities; status + metadata)
├── Global facts          (highest precedence)
├── Installed packages    (optional; snapshot + version pin; retrieval bundles only)
└── Domains               (retrieval operators — do not own data)
    ├── domainKey         (stable slug, e.g. seo)
    ├── metadataFilters   (which tagged memories are eligible)
    ├── retrievalRules    (how to filter / boost during retrieve)
    ├── relationshipConstraints
    ├── Domain facts
    └── Instructions      (per actionKey: audit, report, …)
```

When a client calls `POST /retrieve` **without** `domainKey`, behavior is unchanged — workspace-wide retrieval. Domains are **optional add-ons** that shape a task when requested.

When `domainKey` and optional `domainAction` are set:

1. **Retrieval phase** — global + domain facts and rules influence scope (metadata filters, memory eligibility, relationship neighborhood).
2. **Assembly phase** — facts replace conflicting chunk text; instructions appear in the context hierarchy. Overrides show up in diagnostics traces.

**Fact precedence for domain-scoped retrieval (mandatory):**

```txt
Global facts → Domain facts → Instructions → Retrieved context
```

**Workflow execution** extends this chain with operational objects and previous workflow runs. See [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](../WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md).

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Workspace provisioned | User has session or API key scoped to `workspaceId` |
| Role | **Workspace admin** (or higher) for create/install/archive via dashboard |
| Database migrations | `npm run db:migrate:deploy` from repo root (not run on Vercel build) |
| Memories tagged consistently | Domains filter on **metadata**; ingest must set keys your rules expect |

**Dashboard paths** (Operational Intelligence nav):

| Manager | Path | Phase |
|---------|------|-------|
| Domains | `/domains` | 7 ✅ |
| Global facts | `/global-facts` | 7 ✅ |
| Domain facts | `/domains/:domainId/facts` | 7 ✅ |
| Instructions | `/domains/:id/instructions` | 7 ✅ |
| Packages | `/packages` | 7 ✅ |
| Operational objects | `/objects` | 8 ✅ |
| Workflows | `/workflows` | 9 ✅ |

---

## Slugs and keys (naming rules)

All of these must match `^[a-z][a-z0-9-]*$` (lowercase, hyphens allowed):

| Field | Scope | Example |
|-------|--------|---------|
| `domainKey` | Unique per workspace | `seo`, `inbox`, `competitor` |
| `actionKey` | Unique per domain | `audit`, `report`, `draft-reply` |
| Fact `key` | Unique per scope (global or per domain) | `service-area-primary` |
| `packageKey` | Unique per catalog / install | `hvac-growth-kit` |

`domainKey` is **immutable** after creation (create a new domain if you need a new key). Instructions are versioned per `(domainId, actionKey)` — the `actionKey` stays stable; content gets new versions.

---

## Part 1 — Creating a domain manually

### 1.1 Plan the domain

Answer these before you touch the UI or API:

1. **Task identity** — What single job does this domain represent? (e.g. “SEO content audit”, not “marketing”.)
2. **Memories** — What metadata will ingested content carry? (`domain`, `source`, `seo`, `website`, etc.)
3. **Boundaries** — Which memories should *never* appear in this task? (handled via `metadataFilters` + `retrievalRules`.)
4. **Actions** — Which instruction `actionKey`s do callers need? (`audit`, `report`, …)
5. **Facts** — What must always be true for this task vs the whole workspace?

### 1.2 Create the domain (dashboard)

1. Open **Domain Manager** → **Create domain**.
2. Fill in:
   - **Domain key** — e.g. `seo`
   - **Name** — display label, e.g. `SEO`
   - **Description** — optional operator note
   - **Metadata filters** — comma-separated tags; memories must match these tags/keys to be eligible when `domainKey` is used on retrieve
   - **Retrieval rules** — JSON array (see §1.4)
   - **Relationship constraints** — JSON object (see §1.5)

3. Save. Link to **Facts** and **Instructions** from the domain row.

### 1.3 Create the domain (API)

```http
POST /domains
Authorization: Bearer <session-token>
Content-Type: application/json
```

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "domainKey": "seo",
  "name": "SEO",
  "description": "Search optimization and content ranking tasks",
  "metadataFilters": ["seo", "website"],
  "relationshipConstraints": {
    "allowedTypes": ["supports", "references"],
    "maxDepth": 1,
    "maxNeighbors": 5
  },
  "retrievalRules": [
    {
      "name": "website-content",
      "memoryTypes": ["semantic"],
      "requiredMetadataKeys": ["source"],
      "metadataMatch": { "domain": "website" }
    }
  ]
}
```

### 1.4 Retrieval rules (field reference)

Each rule is a named policy applied during domain-scoped retrieval:

| Field | Purpose |
|-------|---------|
| `name` | Operator label (required) |
| `memoryTypes` | Limit to memory types, e.g. `semantic`, `episodic` |
| `requiredMetadataKeys` | Memory must have **all** listed keys |
| `metadataMatch` | Key/value pairs that must match (value can be string or string array) |
| `rankingTagBoosts` | Additive score boosts by tag |
| `maxExpansionDepth` | Relationship expansion depth for this rule |
| `tokenBudgetOverride` | Optional cap for this rule’s contribution |

**Example — competitor pages only:**

```json
{
  "name": "competitor-crawl",
  "memoryTypes": ["semantic"],
  "metadataMatch": { "domain": "competitor" },
  "requiredMetadataKeys": ["competitor-id"]
}
```

Start with **one simple rule**, verify retrieve traces, then add rules. Overlapping rules are combined during scope resolution — prefer clarity over many redundant rules.

### 1.5 Relationship constraints

Used when retrieval augments results with related memories:

```json
{
  "allowedTypes": ["supports", "references"],
  "maxDepth": 1,
  "targetMetadataKeys": ["source"],
  "maxNeighbors": 5
}
```

| Field | Default | Meaning |
|-------|---------|---------|
| `maxDepth` | `1` | How far to traverse the graph |
| `allowedTypes` | optional | Relationship types allowed |
| `targetMetadataKeys` | optional | Neighbor must carry these metadata keys |
| `maxNeighbors` | optional | Cap neighbors per expansion |

### 1.6 Global facts

Create under **Global Facts** (or `POST /global-facts`). Use for truths that apply to **every** domain:

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "key": "service-area-primary",
  "title": "Primary service area",
  "content": "North Haven, CT and surrounding towns within 25 miles.",
  "priority": 10,
  "appliesToMetadataKeys": ["service-area"]
}
```

Higher `priority` wins within the same scope. `appliesToMetadataKeys` limits **text replacement** to chunks whose metadata matches those keys.

### 1.7 Domain facts

From the domain row → **Facts**, or `POST /domains/:domainId/facts`:

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "key": "target-keyword-primary",
  "title": "Primary target keyword",
  "content": "hvac repair north haven",
  "priority": 8,
  "appliesToMetadataKeys": ["keyword"]
}
```

Domain facts override instructions and retrieved text but **never** global facts.

### 1.8 Instructions (actions)

One domain supports **multiple** instructions via `actionKey`.

**Create** (`POST /domains/:domainId/instructions`):

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "actionKey": "audit",
  "title": "SEO audit",
  "content": "Prioritize current website content and ranking opportunities. Compare against the primary target keyword fact when present."
}
```

**New version** (`POST /domains/:domainId/instructions/audit/version`):

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "title": "SEO audit (v2)",
  "content": "Updated audit behavior…"
}
```

Only one version is **active** per `(domainId, actionKey)`. Older versions remain for history; archive when retired.

### 1.9 Verify domain-scoped retrieval

```http
POST /retrieve
```

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "query": "ranking opportunities for service pages",
  "tokenBudget": 4000,
  "domainKey": "seo",
  "domainAction": "audit"
}
```

**Check:**

| Check | Where |
|-------|--------|
| `executionContext` populated | Retrieval trace / response `result` |
| Memories respect metadata scope | Trace memory list |
| `factOverrides` when facts apply | Retrieval diagnostics → fact override panel |
| 404 + `availableActions` | Wrong `domainAction` |

Omit `domainKey` to confirm workspace-wide retrieval still works unchanged.

---

## Part 2 — Creating packages

A **package** is a versioned JSON **manifest** you can install in one transaction. Installing creates (or updates) domains, global facts, domain facts, and instructions, and records an `InstalledPackage` row with a **snapshot** for rollback.

Packages are **never auto-updated**. Workspace admins: **export → compare → install** (or `POST /packages/update`).

There are **no seed packages** in the repo — you author manifests for your product.

### 2.1 When to use a package vs manual domains

| Use manual domains | Use a package |
|--------------------|---------------|
| One-off workspace customization | Same bundle across many workspaces |
| Experimenting / learning | Versioned product (“HVAC Growth Kit v1.0.0”) |
| Small changes | Large initial setup (many domains + facts) |

You can start manually, then **export** an installed package to get a manifest template.

### 2.2 Manifest structure

Top-level `PackageManifest`:

| Field | Required | Description |
|-------|----------|-------------|
| `packageKey` | yes | Stable slug for the bundle |
| `name` | yes | Display name |
| `version` | yes | Opaque label (`1.0.0`, `2026-06-03`) — not enforced semver |
| `description` | no | Operator / catalog text |
| `domains` | yes | Array of domain definitions |
| `globalFacts` | no | Facts installed at workspace scope |
| `archiveRules` | no | Reserved for future archive policy |
| `metadataConfigs` | no | Reserved for future metadata templates |

Each **domain entry** in `domains[]`:

| Field | Required |
|-------|----------|
| `domainKey`, `name` | yes |
| `metadataFilters` | yes (can be `[]`) |
| `relationshipConstraints` | yes |
| `retrievalRules` | yes (can be `[]`) |
| `description` | no |
| `facts` | no — domain-scoped fact payloads (no ids) |
| `instructions` | no — include `actionKey`, `title`, `content`, `status` |

Manifest facts/instructions omit runtime fields (`factId`, `workspaceId`, `version`, timestamps). The install transaction assigns those.

### 2.3 Full example manifest

Save as `hvac-growth-kit.json` and install via dashboard **Install from manifest** or API.

```json
{
  "packageKey": "hvac-growth-kit",
  "name": "HVAC Growth Kit",
  "version": "1.0.0",
  "description": "SEO + competitor domains for HVAC contractors",
  "globalFacts": [
    {
      "scope": "global",
      "key": "service-area-primary",
      "title": "Primary service area",
      "content": "North Haven, CT and surrounding towns within 25 miles.",
      "priority": 10,
      "status": "active",
      "appliesToMetadataKeys": ["service-area"]
    }
  ],
  "domains": [
    {
      "domainKey": "seo",
      "name": "SEO",
      "description": "Website and ranking tasks",
      "metadataFilters": ["seo", "website"],
      "relationshipConstraints": { "maxDepth": 1, "maxNeighbors": 5 },
      "retrievalRules": [
        {
          "name": "website-content",
          "memoryTypes": ["semantic"],
          "metadataMatch": { "domain": "website" }
        }
      ],
      "facts": [
        {
          "scope": "domain",
          "key": "target-keyword-primary",
          "title": "Primary target keyword",
          "content": "hvac repair north haven",
          "priority": 8,
          "status": "active"
        }
      ],
      "instructions": [
        {
          "actionKey": "audit",
          "title": "SEO audit",
          "content": "Prioritize current website content and ranking opportunities.",
          "status": "active"
        },
        {
          "actionKey": "report",
          "title": "SEO report",
          "content": "Summarize findings for the business owner in plain language.",
          "status": "active"
        }
      ]
    },
    {
      "domainKey": "competitor",
      "name": "Competitor Analysis",
      "metadataFilters": ["competitor"],
      "relationshipConstraints": { "maxDepth": 1 },
      "retrievalRules": [
        {
          "name": "competitor-memories",
          "metadataMatch": { "domain": "competitor" }
        }
      ],
      "instructions": [
        {
          "actionKey": "scan",
          "title": "Competitor scan",
          "content": "Compare service offerings and identify differentiation opportunities.",
          "status": "active"
        }
      ]
    }
  ]
}
```

**Before install:** ensure ingested memories use metadata your rules expect (`domain: website`, tags `seo`, etc.). Otherwise domain-scoped retrieve will return empty or thin results — that is a **data** issue, not a package bug.

### 2.4 Install a package

**Dashboard:** Package Manager → **Install from manifest** → select JSON file.

**API:**

```http
POST /packages/install
```

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "manifest": { },
  "failOnConflict": true
}
```

| Option | Behavior |
|--------|----------|
| `failOnConflict: true` (default) | Abort if a `domainKey`, fact `key`, or conflicting entity already exists |
| `failOnConflict: false` | Skip or merge where the engine allows — use only when you understand overlap |
| `packageDefinitionId` | Install from **middleware catalog** instead of inline manifest (MiddlewareAdmin publishes catalog entries) |

On success you receive `installed` with `installedPackageId`, `packageKey`, `installedVersion`, `snapshotVersion`.

### 2.5 Publish to catalog (optional, MiddlewareAdmin)

For reusable definitions across customers:

```http
POST /platform/packages
```

```json
{
  "manifest": { },
  "published": true
}
```

Workspace installs then reference `packageDefinitionId` from `GET /platform/packages`.

### 2.6 Export, compare, update, rollback

**Workflow for safe updates:**

```txt
1. POST /packages/export     → download current manifest
2. Edit version + content offline
3. POST /packages/compare    → structural diff vs installed
4. POST /packages/update       → apply (or install on another workspace)
5. If needed: POST /packages/rollback with snapshotVersion
```

**Export:**

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "installedPackageId": "01J..."
}
```

**Compare** returns `PackageManifestDiff`: added/removed/changed domain keys, facts, instructions, and flags for metadata/rule/constraint changes.

**Rollback** requires the `snapshotVersion` from the installed package history (set at install/update time).

**Archive** (soft uninstall): `POST /packages/installed/:id/archive` — entities remain in DB but package is marked archived.

### 2.7 Clone to another workspace

Platform/agency admins can clone an installation to another workspace (`POST /packages/clone`) — useful for templated client onboarding. Workspace admins use export + install on the target workspace.

---

## Part 3 — End-to-end operator checklist

### New workspace, single domain (manual)

- [ ] Ingest memories with consistent metadata tags
- [ ] Add global facts (service area, policies)
- [ ] Create domain with `domainKey`, filters, rules
- [ ] Add domain facts and at least one instruction (`actionKey`)
- [ ] Test `POST /retrieve` with `domainKey` + `domainAction`
- [ ] Review diagnostics for `factOverrides`

### Productized bundle (package)

- [ ] Author manifest JSON (start from export of a pilot workspace if possible)
- [ ] Bump `version` on every publish
- [ ] Install on pilot workspace with `failOnConflict: true`
- [ ] Compare before rolling to production workspaces
- [ ] Document required ingest metadata for customers

### Ongoing changes

- [ ] **Instructions:** new version, never edit history in place
- [ ] **Facts:** patch content or archive obsolete keys
- [ ] **Domains:** archive unused domains; avoid reusing `domainKey`
- [ ] **Packages:** never rely on auto-update — export/compare/install

---

## Common mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| No metadata on memories | Empty domain-scoped retrieve | Tag at ingest; align `metadataFilters` / `metadataMatch` |
| `domainKey` typo in API | 404 domain not found | List domains; use exact slug |
| Wrong `domainAction` | 404 with `availableActions` | Create instruction or fix action key |
| Duplicate keys on install | 409 conflict | Export existing state; bump keys or archive old facts |
| Expecting instructions to override global facts | Wrong precedence in output | Move truth to global fact or domain fact |
| Editing package in production without compare | Surprising removals | Always run compare diff first |
| Running migrations only on Vercel deploy | Build fails or schema drift | `npm run db:migrate:deploy` locally / CI |

---

## Lifecycle reference

| Operation | Who | Effect |
|-----------|-----|--------|
| Create / update domain, facts, instructions | Workspace admin+ | Active in execution |
| Archive | Workspace admin+ | Hidden from execution; row kept |
| Hard delete | Middleware admin only | Permanent removal |
| Install package | Workspace admin+ | Transactional create + snapshot |
| Archive installed package | Workspace admin+ | Soft uninstall |

---

## Related documents

| Doc | Use for |
|-----|---------|
| [API_SURFACE.md](./API_SURFACE.md) | Exact routes and bodies |
| [CONTRACTS.md](./CONTRACTS.md) | Types and Prisma models |
| [RBAC.md](./RBAC.md) | Who can do what |
| [IMPLEMENTATION_INSTRUCTIONS.md](./IMPLEMENTATION_INSTRUCTIONS.md) | Locked product decisions |
| [RETRIEVAL_ARCHITECTURE.md](../RETRIEVAL_ARCHITECTURE.md) | How middleware retrieve works underneath |

---

## Quick reference — dashboard map

```txt
Operational Intelligence
├── Domain Manager      → create/edit/archive domains
├── Global Facts        → workspace-wide truths
└── Package Manager     → install / export / compare

Per domain (from Domain Manager links)
├── …/facts             → domain-scoped facts
└── …/instructions      → actions + version history

Retrieval → Diagnostics   → fact override panel when domain-scoped
```

This is the intended operator loop: **configure domains → attach facts/instructions → optionally package for reuse → verify via retrieve traces.**
