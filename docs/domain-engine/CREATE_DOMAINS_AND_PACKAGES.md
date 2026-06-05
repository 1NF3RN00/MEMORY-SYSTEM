# Operational Intelligence Setup — Operator Guide

This guide explains how to **design, create, install, execute, and maintain** everything in a workspace’s operational intelligence layer:

- **Operational objects** — organize real-world entities
- **Domains, facts, and instructions** — task-scoped retrieval
- **Packages** — reusable retrieval bundles
- **Workflows** — executable intelligence processes with runs, outputs, and Historian replay

It is written for workspace admins and integrators using the **dashboard** or **HTTP API**. Every dashboard action maps to an API route documented in [API_SURFACE.md](./API_SURFACE.md).

| Doc | Use for |
|-----|---------|
| [API_SURFACE.md](./API_SURFACE.md) | Exact routes, bodies, RBAC |
| [CONTRACTS.md](./CONTRACTS.md) | TypeScript / Prisma shapes |
| [RBAC.md](./RBAC.md) | Who can do what |
| [DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md](../DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md) | Domain retrieval architecture |
| [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](../WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md) | Workflow + object product spec |

---

## What you are building

| Concept | What it is | When to use it |
|---------|------------|----------------|
| **Workspace** | One client / intelligence environment | Already exists after provisioning |
| **Operational object** | Metadata-driven entity (customer, competitor, campaign, …) | Organize real-world things; augment workflow context — not a memory |
| **Global fact** | Truth for the whole workspace (service area, policy) | Always wins over domain facts and retrieved text |
| **Domain** | Task-scoped retrieval operator | SEO audit, inbox triage, competitor scan — each is a **domain**, not a “category” |
| **Domain fact** | Truth that applies only inside one domain | Target keyword, escalation rule |
| **Instruction** | Versioned behavior for `domainKey` + `actionKey` | “How to run an audit” vs “how to write a report” |
| **Package** | Installable bundle of domains + facts + instructions | Reuse the same retrieval setup across workspaces — **no execution logic** |
| **Workflow** | Executable intelligence process | Links domains/packages/objects; runs retrieval; produces **outputs** and **workflow runs** |
| **Workflow run** | Observable, replayable execution record | One execution of a workflow with a query; chains prior runs into context |

**Middleware stays domain-agnostic.** You never hardcode “SEO” in retrieval core code. You express SEO (or anything else) as configuration, packages, and workflows.

**Domains retrieve. Workflows execute. Packages bundle retrieval — they do not run jobs.**

---

## Mental model

```txt
Workspace
├── Operational objects   (organize entities; status + metadata)
├── Global facts          (highest precedence)
├── Installed packages    (optional; snapshot + version pin; retrieval bundles only)
├── Domains               (retrieval operators — do not own data)
│   ├── domainKey
│   ├── metadataFilters, retrievalRules, relationshipConstraints
│   ├── Domain facts
│   └── Instructions (per actionKey)
└── Workflows             (executable intelligence — do not own data)
    ├── links domains[] + packages[] (packageKey slugs)
    ├── instructionRefs[] (optional; else all active instructions from linked domains)
    ├── objectTypeFilters[] (optional; else all object types, capped)
    ├── outputTypes[] (report, insight, …)
    └── Workflow runs → outputs → Historian replay
```

### Precedence chains

**Domain-scoped retrieval** (`POST /retrieve` with `domainKey`):

```txt
Global facts → Domain facts → Instructions → Retrieved context
```

**Workflow execution** (`POST /workflows/:id/execute`) extends that chain:

```txt
Global facts → Domain facts → Instructions → Operational objects → Retrieved context → Previous workflow runs
```

When a client calls `POST /retrieve` **without** `domainKey`, behavior is unchanged — workspace-wide retrieval. Domains and workflows are **optional add-ons**.

---

## Recommended build order

For a new workspace, configure in this order so workflows have something to consume:

| Step | What | Why |
|------|------|-----|
| 1 | Ingest memories with consistent metadata | Domains filter on metadata tags |
| 2 | Global facts | Workspace-wide truths |
| 3 | Domains + domain facts + instructions | Task-scoped retrieval |
| 4 | Package (optional) | Reuse bundle across workspaces |
| 5 | Operational objects | Entities workflows and retrieval can reference |
| 6 | Workflow | Link domains/packages; define output types |
| 7 | Execute workflow → inspect run → replay | Verify end-to-end |

You can skip packages and create domains manually. You can skip objects if your workflow only needs facts + retrieval. Workflows **fail at execute time** if linked `domainKey` or `packageKey` refs are missing in the workspace.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Workspace provisioned | Session or API key scoped to `workspaceId` |
| Role | **Workspace admin+** for create/install/archive; **workspace user+** for execute and read |
| Database migrations | `npm run db:migrate:deploy` from repo root (not run on Vercel build) |
| Memories tagged consistently | Domains filter on **metadata**; ingest must set keys your rules expect |

Every API call requires `workspaceId` (query param for GET, body field for POST/PATCH). Authenticate with `Authorization: Bearer <token>`.

### Dashboard paths (Operational Intelligence)

| Manager | Path | Purpose |
|---------|------|---------|
| Domain Manager | `/domains` | Create/edit/archive domains |
| Global Facts | `/global-facts` | Workspace-wide truths |
| Domain facts | `/domains/:domainId/facts` | Per-domain truths |
| Instructions | `/domains/:domainId/instructions` | Versioned actions |
| Package Manager | `/packages` | Install / export / compare |
| Object Manager | `/objects` | Operational entities |
| Workflow Manager | `/workflows` | Registry CRUD |
| Workflow runs | `/workflows/:workflowId/runs` | Execute + run history |
| Workflow outputs | `/workflows/:workflowId/outputs` | Output browser |
| Workflow replay | `/workflows/runs/:runId/replay` | Historian snapshot view |

Historian: `/historian/:traceId` — workflow runs use `workflowRunId` as `retrievalTraceId`.

---

## Slugs and keys (naming rules)

All slugs must match `^[a-z][a-z0-9-]*$` (lowercase, hyphens allowed):

| Field | Scope | Example |
|-------|--------|---------|
| `domainKey` | Unique per workspace | `seo`, `inbox`, `competitor` |
| `actionKey` | Unique per domain | `audit`, `report`, `draft-reply` |
| Fact `key` | Unique per scope (global or per domain) | `service-area-primary` |
| `packageKey` | Unique per catalog / install | `hvac-growth-kit` |
| `objectType` | Operator-defined | `customer`, `competitor`, `campaign` |

`domainKey` is **immutable** after creation. Instructions are versioned per `(domainId, actionKey)`. Object **status** is free-form metadata — the middleware never enforces status enums.

---

## Part 1 — Domains, facts, and instructions

Domains are retrieval operators. Configure them before workflows that link to them.

### 1.1 Plan the domain

Answer these before you touch the UI or API:

1. **Task identity** — What single job does this domain represent? (e.g. “SEO content audit”, not “marketing”.)
2. **Memories** — What metadata will ingested content carry? (`domain`, `source`, `seo`, `website`, etc.)
3. **Boundaries** — Which memories should *never* appear in this task? (`metadataFilters` + `retrievalRules`.)
4. **Actions** — Which instruction `actionKey`s do callers need? (`audit`, `report`, …)
5. **Facts** — What must always be true for this task vs the whole workspace?

### 1.2 Create the domain (dashboard)

1. Open **Domain Manager** → **Create domain**.
2. Fill in domain key, name, description, metadata filters, retrieval rules (JSON), relationship constraints (JSON).
3. Save. Use row links for **Facts** and **Instructions**.

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

**List / get / update / archive:**

| Action | Method | Path |
|--------|--------|------|
| List | GET | `/domains?workspaceId=` |
| Get | GET | `/domains/:domainId?workspaceId=` |
| Update | PATCH | `/domains/:domainId` |
| Archive | POST | `/domains/:domainId/archive` |

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
| `objectTypeFilter` | Optional object types pulled into workflow context when domain is linked |

Start with **one simple rule**, verify retrieve traces, then add rules.

### 1.5 Relationship constraints

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

**Dashboard:** Global Facts → Add fact.

**API:**

```http
POST /global-facts
```

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

**Dashboard:** Domain Manager → domain row → Facts.

**API:** `POST /domains/:domainId/facts`

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

**Create** — `POST /domains/:domainId/instructions`:

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "actionKey": "audit",
  "title": "SEO audit",
  "content": "Prioritize current website content and ranking opportunities. Compare against the primary target keyword fact when present."
}
```

**New version** — `POST /domains/:domainId/instructions/audit/version`:

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "title": "SEO audit (v2)",
  "content": "Updated audit behavior…"
}
```

Only one version is **active** per `(domainId, actionKey)`.

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

| Check | Where |
|-------|--------|
| `executionContext` populated | Retrieval trace / response |
| Memories respect metadata scope | Trace memory list |
| `factOverrides` when facts apply | Retrieval diagnostics |
| 404 + `availableActions` | Wrong `domainAction` |

Omit `domainKey` to confirm workspace-wide retrieval still works unchanged.

---

## Part 2 — Packages

A **package** is a versioned JSON **manifest** installed in one transaction. Installing creates (or updates) domains, global facts, domain facts, and instructions, and records an `InstalledPackage` row with a **snapshot** for rollback.

Packages contain **retrieval configuration only** — no workflow or execution logic.

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
| `packageKey` | yes | Stable slug — referenced by workflows as `packages[]` |
| `name` | yes | Display name |
| `version` | yes | Opaque label (`1.0.0`) — not enforced semver |
| `description` | no | Operator / catalog text |
| `domains` | yes | Array of domain definitions |
| `globalFacts` | no | Facts installed at workspace scope |

Each **domain entry** in `domains[]`: `domainKey`, `name`, `metadataFilters`, `relationshipConstraints`, `retrievalRules` required; optional `facts`, `instructions`.

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

**Before install:** ensure ingested memories use metadata your rules expect. Empty domain-scoped retrieve is usually a **data** issue, not a package bug.

### 2.4 Install a package

**Dashboard:** Package Manager → **Install from manifest**.

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
| `failOnConflict: false` | Skip or merge where the engine allows |
| `packageDefinitionId` | Install from middleware catalog instead of inline manifest |

On success you receive `installed` with `installedPackageId`, `packageKey`, `installedVersion`, `snapshotVersion`.

### 2.5 Export, compare, update, rollback

```txt
1. POST /packages/export     → download current manifest
2. Edit version + content offline
3. POST /packages/compare    → structural diff vs installed
4. POST /packages/update       → apply
5. If needed: POST /packages/rollback with snapshotVersion
```

**Archive** (soft uninstall): `POST /packages/installed/:id/archive`.

**Clone** to another workspace: `POST /packages/clone` (platform/agency admins).

---

## Part 3 — Operational objects

Operational objects organize real-world entities. They are **not** memories — they carry `objectType`, `name`, free-form `status`, and arbitrary `metadata`.

Workflows load objects into execution context (filtered by `objectTypeFilters` on the workflow, or all types up to a cap when unset).

### 3.1 When to create objects

| Use case | Example |
|----------|---------|
| Track customers, competitors, campaigns | `objectType: customer`, `status: client` |
| Scope workflow context | Workflow `objectTypeFilters: ["competitor"]` |
| Augment retrieval over time | Metadata keys referenced by domain rules |

Status belongs to **objects**, not workflows or domains. The middleware never validates status values.

### 3.2 Create an object (dashboard)

1. Open **Object Manager** → **Add object**.
2. Set **object type** (slug), **name**, **status**, **metadata** (JSON object).
3. Save.

### 3.3 Create an object (API)

```http
POST /objects
```

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "objectType": "competitor",
  "name": "CoolAir HVAC",
  "status": "active",
  "metadata": {
    "region": "Connecticut",
    "website": "https://example.com",
    "tier": "primary"
  }
}
```

**List / get / update / archive:**

| Action | Method | Path |
|--------|--------|------|
| List | GET | `/objects?workspaceId=&objectType=&status=` |
| Get | GET | `/objects/:objectId?workspaceId=` |
| Update | PATCH | `/objects/:objectId` |
| Archive | POST | `/objects/:objectId/archive` |

Optional list filters: `metadataMatch` (JSON-encoded), `includeArchived`, `limit`, `cursor`.

---

## Part 4 — Workflows

Workflows are the **execution layer**. They:

1. Resolve execution context (facts, instructions, objects, prior runs)
2. Run **domain-scoped retrieval** per linked domain (using `instructionRefs` for `domainAction` when set)
3. Produce deterministic **outputs** (reports / insights today; LLM-generated facts/memories in a future phase)
4. Persist **workflow runs** with Historian **replay** snapshots

Workflows never maintain hidden state — persistence is only through facts, memories, objects, and workflow runs.

### 4.1 Plan the workflow

Before creating a workflow:

1. **Domains exist** — either listed in `domains[]` or provided via an installed `packageKey` in `packages[]`.
2. **Instructions** — either explicit `instructionRefs[]` or rely on all active instructions from linked domains.
3. **Objects** — optional; set `objectTypeFilters[]` to limit which object types load into context.
4. **Output types** — e.g. `report`, `insight` (defaults to `report` if empty).
5. **Query pattern** — what the caller passes to `execute` (e.g. “Analyze competitor pricing since last run”).

Linking a **package** expands the domain set: every `domainKey` in that package’s manifest is included at execution time, in addition to explicit `domains[]`.

### 4.2 Create a workflow (dashboard)

1. Open **Workflow Manager** → **Add workflow**.
2. Fill in name, description, comma-separated domains and packages (`packageKey` slugs), instruction refs JSON, output types, object type filters.
3. Save. Use **Runs** / **Outputs** links from the row.

### 4.3 Create a workflow (API)

```http
POST /workflows
Authorization: Bearer <session-token>
Content-Type: application/json
```

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "name": "Competitor Analysis",
  "description": "Periodic competitor scan and delta report",
  "domains": ["competitor"],
  "packages": ["hvac-growth-kit"],
  "instructionRefs": [
    { "domainKey": "competitor", "actionKey": "scan" }
  ],
  "outputTypes": ["report", "insight"],
  "objectTypeFilters": ["competitor"]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `domains` | `string[]` | `domainKey` slugs — must exist and be active |
| `packages` | `string[]` | `packageKey` slugs — must be installed and active |
| `instructionRefs` | `{ domainKey, actionKey }[]` | Optional; omit to load all active instructions from linked domains |
| `outputTypes` | `string[]` | Default `["report"]` if omitted |
| `objectTypeFilters` | `string[]` | Optional; omit to load all object types (limit 100) |

**Registry CRUD:**

| Action | Method | Path | Role |
|--------|--------|------|------|
| List | GET | `/workflows?workspaceId=` | user+ |
| Get | GET | `/workflows/:workflowId?workspaceId=` | user+ |
| Create | POST | `/workflows` | admin+ |
| Update | PATCH | `/workflows/:workflowId` | admin+ |
| Archive | POST | `/workflows/:workflowId/archive` | admin+ |
| Delete | DELETE | `/workflows/:workflowId?workspaceId=` | middleware admin |

Set `"active": false` via PATCH to disable execution without archiving.

### 4.4 Preview execution context (optional)

Inspect what a run **would** load — without executing:

```http
GET /workflows/:workflowId/execution-context?workspaceId=&previousRunLimit=10
```

Response: `executionContext` with `globalFacts`, `domainFacts`, `instructions`, `objects`, `previousWorkflowRuns`, empty `retrievedContext` (retrieval happens only on execute).

Use this to debug missing domains, facts, or prior runs before calling execute.

### 4.5 Execute a workflow

**Dashboard:** Workflow → **Runs** → **Execute workflow** → enter query.

**API:**

```http
POST /workflows/:workflowId/execute
```

```json
{
  "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
  "query": "Analyze competitor pricing changes since last run",
  "tokenBudget": 8000,
  "previousRunLimit": 10
}
```

| Field | Required | Default | Meaning |
|-------|----------|---------|---------|
| `query` | yes | — | Drives retrieval per linked domain and output content |
| `tokenBudget` | no | `4000` | Per-domain retrieval token budget |
| `previousRunLimit` | no | `10` | Max prior **completed** runs included in context |

**Execute response** (synchronous today):

```json
{
  "workflowRunId": "01J...",
  "status": "completed",
  "outputs": [
    {
      "outputId": "01J...",
      "workflowRunId": "01J...",
      "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
      "outputType": "report",
      "title": "Competitor Analysis — report",
      "content": "# Competitor Analysis\n\nQuery: Analyze competitor pricing…",
      "data": { "query": "...", "workflowId": "...", "layers": [], "retrievedPackageCount": 1 },
      "createdAt": "2026-06-04T12:00:00.000Z"
    }
  ],
  "generatedFactIds": [],
  "generatedMemoryIds": [],
  "generatedObjectIds": [],
  "executionContext": { }
}
```

Outputs are **deterministic** today (structured report from context layers). `generatedFactIds` / memory / object IDs are reserved for future LLM write-back.

**Errors:**

| Code | When |
|------|------|
| 409 | Another run for this workflow is already `running` (single-flight) |
| 404 | Workflow inactive or missing refs — body may include `missingRefs: ["domain:foo", "package:bar"]` |
| 400 | Empty `query` or workflow not active |

### 4.6 Inspect runs and outputs

**List runs:**

```http
GET /workflows/:workflowId/runs?workspaceId=&limit=50
```

**Run detail** (outputs + full execution context):

```http
GET /workflow-runs/:workflowRunId?workspaceId=
```

**Archive a run:** `POST /workflow-runs/:workflowRunId/archive` with `{ "workspaceId": "..." }`.

**Dashboard:** `/workflows/:workflowId/outputs` — searchable browser across run outputs.

### 4.7 Sequential runs and context chaining

Each **completed** run is eligible for inclusion in the next run’s `executionContext.previousWorkflowRuns` (up to `previousRunLimit`).

Verify chaining:

1. Execute workflow with query A → note `workflowRunId`.
2. Execute again with query B.
3. `GET /workflow-runs/:secondRunId` → `executionContext.previousWorkflowRuns` should include the first run.

This is how workflows accumulate operational history without hidden state.

### 4.8 Historian replay

Every successful execute captures a `ReplaySnapshot` keyed by `workflowRunId` as `retrievalTraceId`.

**Fetch replay:**

```http
GET /workflow-runs/:workflowRunId/replay?workspaceId=
```

Response includes standard Historian snapshot fields plus `workflowReplay`:

```json
{
  "replay": {
    "replayId": "01J...",
    "retrievalTraceId": "01J...",
    "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
    "originalQuery": "Analyze competitor pricing changes since last run",
    "integrityHash": "...",
    "workflowReplay": {
      "workflowId": "01J...",
      "workflowRunId": "01J...",
      "workspaceId": "01KT7D64WDCDGTHEYK93KEXAPH",
      "executionContext": { },
      "outputs": [],
      "generatedFactIds": [],
      "generatedMemoryIds": [],
      "generatedObjectIds": []
    }
  }
}
```

**Dashboard:** `/workflows/runs/:runId/replay` — layer counts, outputs, link to `/historian/:traceId`.

If no snapshot exists yet, the replay endpoint lazily captures one from the stored run detail.

---

## Part 5 — End-to-end examples

### Example A — Manual domain → workflow (API)

```txt
1. POST /global-facts          → service area
2. POST /domains               → domainKey: competitor
3. POST /domains/:id/facts     → domain fact
4. POST /domains/:id/instructions → actionKey: scan
5. POST /objects               → objectType: competitor
6. POST /workflows             → domains: [competitor], instructionRefs, outputTypes
7. GET  /workflows/:id/execution-context → verify layers
8. POST /workflows/:id/execute → query + inspect outputs
9. GET  /workflow-runs/:id/replay → verify Historian payload
10. POST /workflows/:id/execute again → confirm prior run in context
```

### Example B — Package → workflow (productized)

```txt
1. POST /packages/install      → hvac-growth-kit manifest
2. Ingest memories with expected metadata tags
3. POST /objects               → customers / competitors as needed
4. POST /workflows             → packages: [hvac-growth-kit], domains: [seo]
5. POST /workflows/:id/execute
6. Export / compare / update package on pilot before rolling to other workspaces
```

### Example C — Integrator loop (no dashboard)

Use the same routes from any HTTP client. Typical automation:

- Poll `GET /workflows?workspaceId=` for registry
- `POST .../execute` on a schedule or webhook
- Store `workflowRunId` + outputs in your app
- `GET .../replay` for audit exports

---

## Part 6 — Operator checklists

### New workspace (full stack)

- [ ] Ingest memories with consistent metadata tags
- [ ] Add global facts (service area, policies)
- [ ] Create domains OR install a package
- [ ] Add domain facts and instructions (`actionKey`s)
- [ ] Test `POST /retrieve` with `domainKey` + `domainAction`
- [ ] Create operational objects for entities you track
- [ ] Create workflow linking domains/packages/objects
- [ ] Preview `GET .../execution-context`
- [ ] Execute twice; confirm second run sees first in `previousWorkflowRuns`
- [ ] Fetch replay; open Historian trace

### Productized bundle

- [ ] Author manifest JSON (export from pilot workspace if possible)
- [ ] Bump `version` on every publish
- [ ] Install with `failOnConflict: true`
- [ ] Compare before rolling to production workspaces
- [ ] Document required ingest metadata for customers
- [ ] Ship matching workflow(s) that reference `packageKey`

### Ongoing changes

- [ ] **Instructions:** new version, never edit history in place
- [ ] **Facts:** patch content or archive obsolete keys
- [ ] **Domains:** archive unused domains; avoid reusing `domainKey`
- [ ] **Packages:** export → compare → update — never rely on auto-update
- [ ] **Objects:** update metadata/status; archive when retired
- [ ] **Workflows:** PATCH to change links; archive when retired
- [ ] **Runs:** archive old runs if you need to trim `previousWorkflowRuns` context

---

## Common mistakes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| No metadata on memories | Empty domain-scoped retrieve | Tag at ingest; align filters / `metadataMatch` |
| `domainKey` typo | 404 domain not found | List domains; use exact slug |
| Wrong `domainAction` | 404 with `availableActions` | Create instruction or fix action key |
| Workflow `packages: ["foo"]` but not installed | 404 `missingRefs: ["package:foo"]` | Install package first |
| Workflow links domain not in workspace | 404 `missingRefs: ["domain:bar"]` | Create domain or add via package |
| Duplicate keys on install | 409 conflict | Export existing state; bump keys or archive |
| Expecting instructions to override global facts | Wrong precedence | Move truth to global or domain fact |
| Editing package without compare | Surprising removals | Always run compare diff first |
| Empty workflow objects | No `objectTypeFilters` and no objects created | Create objects or set filters |
| Second run missing first run | First run not `completed` or archived | Complete first run; check `previousRunLimit` |
| Execute while prior run running | 409 conflict | Wait or archive stuck run |
| Migrations only on Vercel deploy | Schema drift | `npm run db:migrate:deploy` locally / CI |

---

## Lifecycle reference

| Operation | Who | Effect |
|-----------|-----|--------|
| Create / update domain, facts, instructions | Workspace admin+ | Active in retrieval |
| Create / update objects, workflows | Workspace admin+ | Active in workflow context |
| Execute workflow | Workspace user+ | Creates run + outputs + replay snapshot |
| Archive domain, fact, instruction, object, workflow, run | Workspace admin+ | Hidden from active use; row kept |
| Hard delete | Middleware admin only | Permanent removal |
| Install / update package | Workspace admin+ | Transactional create + snapshot |

---

## Quick reference — dashboard map

```txt
Operational Intelligence
├── Domain Manager        → domains
├── Global Facts          → workspace truths
├── Object Manager        → operational objects
├── Workflow Manager      → registry; links to Runs / Outputs
└── Package Manager       → install / export / compare

Per domain (from Domain Manager)
├── …/facts               → domain-scoped facts
└── …/instructions        → actions + version history

Per workflow (from Workflow Manager)
├── …/runs                → execute, inspect runs, replay link
├── …/outputs             → searchable output browser
└── …/runs/:runId/replay  → Historian reconstruction

Retrieval → Diagnostics   → fact override panel when domain-scoped
Operations → Historian    → `/historian/:workflowRunId` for workflow traces
```

**Intended operator loop:**

```txt
Configure retrieval (domains + facts + packages)
  → organize entities (objects)
  → define workflow (links + output types)
  → execute → inspect runs/outputs
  → replay for audit
  → repeat (prior runs chain automatically)
```

---

## Related documents

| Doc | Use for |
|-----|---------|
| [API_SURFACE.md](./API_SURFACE.md) | Exact routes and bodies |
| [CONTRACTS.md](./CONTRACTS.md) | Types and Prisma models |
| [RBAC.md](./RBAC.md) | Role matrix |
| [IMPLEMENTATION_INSTRUCTIONS.md](./IMPLEMENTATION_INSTRUCTIONS.md) | Locked product decisions |
| [RETRIEVAL_ARCHITECTURE.md](../RETRIEVAL_ARCHITECTURE.md) | Middleware retrieve internals |
| [OPERATIONAL_HISTORIAN_REPLAY_SYSTEM.md](../OPERATIONAL_HISTORIAN_REPLAY_SYSTEM.md) | Replay requirements |
