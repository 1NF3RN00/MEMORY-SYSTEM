# Domain Engine — API Surface

All routes are workspace-scoped unless marked **global**. Register under `apps/api/src/routes/domains.ts` (and `packages.ts` if split).

Prefix: session or API key with workspace scope. See [RBAC.md](./RBAC.md).

---

## Retrieval (extend existing)

### `POST /retrieve`

**Existing body** plus optional:

```json
{
  "workspaceId": "01J...",
  "query": "ranking opportunities",
  "tokenBudget": 4000,
  "retrievalMode": "precision",
  "domainKey": "seo",
  "domainAction": "audit"
}
```

| Field | Required | Behavior |
|-------|----------|----------|
| `domainKey` | No | When omitted, workspace-wide retrieval (unchanged). |
| `domainAction` | No | When `domainKey` set, selects instruction `actionKey`. Ignored without `domainKey`. |

**Response additions** (in trace / result JSON):

```json
{
  "executionContext": { "...": "DomainExecutionContext" },
  "factOverrides": [ { "...": "FactOverrideRecord" } ]
}
```

---

## Global facts

| Method | Path | Role |
|--------|------|------|
| GET | `/global-facts?workspaceId=` | workspace_admin+ |
| POST | `/global-facts` | workspace_admin+ |
| PATCH | `/global-facts/:factId` | workspace_admin+ |
| POST | `/global-facts/:factId/archive` | workspace_admin+ |
| DELETE | `/global-facts/:factId` | middleware_admin |

**POST body:**

```json
{
  "workspaceId": "01J...",
  "key": "service-area-primary",
  "title": "Primary service area",
  "content": "North Haven, CT and surrounding towns.",
  "priority": 10,
  "appliesToMetadataKeys": ["service-area"]
}
```

---

## Domains

| Method | Path | Role |
|--------|------|------|
| GET | `/domains?workspaceId=` | workspace_user+ (read) |
| GET | `/domains/:domainId` | workspace_user+ |
| POST | `/domains` | workspace_admin+ |
| PATCH | `/domains/:domainId` | workspace_admin+ |
| POST | `/domains/:domainId/archive` | workspace_admin+ |
| DELETE | `/domains/:domainId` | middleware_admin |

**POST body:**

```json
{
  "workspaceId": "01J...",
  "domainKey": "seo",
  "name": "SEO",
  "description": "Search optimization tasks",
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

---

## Domain facts

| Method | Path | Role |
|--------|------|------|
| GET | `/domains/:domainId/facts` | workspace_user+ |
| POST | `/domains/:domainId/facts` | workspace_admin+ |
| PATCH | `/domain-facts/:factId` | workspace_admin+ |
| POST | `/domain-facts/:factId/archive` | workspace_admin+ |
| DELETE | `/domain-facts/:factId` | middleware_admin |

---

## Instructions

| Method | Path | Role |
|--------|------|------|
| GET | `/domains/:domainId/instructions` | workspace_user+ |
| GET | `/domains/:domainId/instructions/:actionKey` | workspace_user+ |
| GET | `/domains/:domainId/instructions/:actionKey/versions` | workspace_admin+ |
| POST | `/domains/:domainId/instructions` | workspace_admin+ |
| POST | `/domains/:domainId/instructions/:actionKey/version` | workspace_admin+ |
| POST | `/instructions/:instructionId/archive` | workspace_admin+ |

**POST body (create):**

```json
{
  "workspaceId": "01J...",
  "actionKey": "audit",
  "title": "SEO audit",
  "content": "Prioritize current website content and ranking opportunities."
}
```

**Version:** creates new row with `version+1`, sets `isActive=true`, deactivates prior active row for same `(domainId, actionKey)`.

---

## Packages

### Workspace-scoped

| Method | Path | Role |
|--------|------|------|
| GET | `/packages/installed?workspaceId=` | workspace_admin+ |
| POST | `/packages/install` | workspace_admin+ |
| POST | `/packages/export` | workspace_admin+ |
| POST | `/packages/compare` | workspace_admin+ |
| POST | `/packages/rollback` | workspace_admin+ |
| POST | `/packages/installed/:id/archive` | workspace_admin+ |

**Install:**

```json
{
  "workspaceId": "01J...",
  "packageDefinitionId": "01J...",
  "failOnConflict": true
}
```

Or install from uploaded manifest:

```json
{
  "workspaceId": "01J...",
  "manifest": { "...": "PackageManifest" }
}
```

**Export:**

```json
{
  "workspaceId": "01J...",
  "installedPackageId": "01J..."
}
```

Returns `PackageManifest` JSON for download.

**Compare:**

```json
{
  "workspaceId": "01J...",
  "installedPackageId": "01J...",
  "candidateManifest": { "...": "PackageManifest" }
}
```

Returns structural diff (domains/facts/instructions added/changed/removed).

**Rollback:**

```json
{
  "workspaceId": "01J...",
  "installedPackageId": "01J...",
  "snapshotVersion": "2026-06-03T12:00:00Z"
}
```

### Global catalog (MiddlewareAdmin)

| Method | Path | Role |
|--------|------|------|
| GET | `/platform/packages` | middleware_admin |
| POST | `/platform/packages` | middleware_admin |
| PATCH | `/platform/packages/:id` | middleware_admin |

---

## Tenancy (Phase 1 schema, Phase 6+ routes)

Deferred minimal routes:

| Method | Path | Role |
|--------|------|------|
| POST | `/platform/agencies` | middleware_admin |
| POST | `/platform/platforms` | middleware_admin |
| PATCH | `/workspaces/:id/platform` | platform_admin+ |

---

## Replay payload extension

`ReplaySnapshot.payload` and retrieval `result` must include:

```json
{
  "executionContext": {},
  "factOverrides": [],
  "domainKey": "seo",
  "domainAction": "audit"
}
```

Historian replay uses these fields to reconstruct context assembly identically.

---

# Phase 8+ — Operational Objects and Workflows

See [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](../WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md) for product architecture.

---

## Operational objects

| Method | Path | Role |
|--------|------|------|
| GET | `/objects?workspaceId=&objectType=&status=` | workspace_user+ |
| GET | `/objects/:objectId` | workspace_user+ |
| POST | `/objects` | workspace_admin+ |
| PATCH | `/objects/:objectId` | workspace_admin+ |
| POST | `/objects/:objectId/archive` | workspace_admin+ |
| DELETE | `/objects/:objectId` | middleware_admin |

**POST body:**

```json
{
  "workspaceId": "01J...",
  "objectType": "customer",
  "name": "Acme HVAC",
  "status": "client",
  "metadata": {
    "industry": "HVAC",
    "region": "Connecticut"
  }
}
```

**GET query:** `objectType`, `status`, `metadataMatch` (JSON-encoded), `includeArchived`, `limit`, `cursor`.

---

## Workflows

| Method | Path | Role |
|--------|------|------|
| GET | `/workflows?workspaceId=` | workspace_user+ |
| GET | `/workflows/:workflowId` | workspace_user+ |
| POST | `/workflows` | workspace_admin+ |
| PATCH | `/workflows/:workflowId` | workspace_admin+ |
| POST | `/workflows/:workflowId/archive` | workspace_admin+ |
| DELETE | `/workflows/:workflowId` | middleware_admin |

**POST body:**

```json
{
  "workspaceId": "01J...",
  "name": "Competitor Analysis",
  "description": "Periodic competitor scan and delta report",
  "domains": ["competitor", "strategy"],
  "packages": ["marketing-kit"],
  "instructionRefs": [
    { "domainKey": "competitor", "actionKey": "analyze" }
  ],
  "outputTypes": ["report", "insight"],
  "objectTypeFilters": ["competitor"]
}
```

---

## Workflow execution

| Method | Path | Role |
|--------|------|------|
| POST | `/workflows/:workflowId/execute` | workspace_user+ |
| GET | `/workflows/:workflowId/runs` | workspace_user+ |
| GET | `/workflow-runs/:workflowRunId` | workspace_user+ |
| POST | `/workflow-runs/:workflowRunId/archive` | workspace_admin+ |

**Execute body:**

```json
{
  "workspaceId": "01J...",
  "query": "Analyze competitor pricing changes since last run",
  "tokenBudget": 8000,
  "previousRunLimit": 10
}
```

**Execute response:**

```json
{
  "workflowRunId": "01J...",
  "status": "completed",
  "outputs": [ { "...": "WorkflowOutput" } ],
  "generatedFactIds": [],
  "generatedMemoryIds": [],
  "generatedObjectIds": [],
  "executionContext": { "...": "WorkflowExecutionContext" }
}
```

Execution is asynchronous-capable: initial response may return `status: running` with poll via `GET /workflow-runs/:id`.

---

## Workflow replay payload extension

`ReplaySnapshot.payload` for workflow operations must include:

```json
{
  "workflowId": "01J...",
  "workflowRunId": "01J...",
  "workspaceId": "01J...",
  "executionContext": { "...": "WorkflowExecutionContext" },
  "outputs": [],
  "generatedFactIds": [],
  "generatedMemoryIds": [],
  "generatedObjectIds": []
}
```

Historian replay reconstructs workflow context and outputs identically per [OPERATIONAL_HISTORIAN_REPLAY_SYSTEM.md](../OPERATIONAL_HISTORIAN_REPLAY_SYSTEM.md).

---

## Error codes

| Code | When |
|------|------|
| 404 | `domainKey` not found in workspace |
| 404 | `domainAction` / `actionKey` not found; include `availableActions: string[]` |
| 404 | `workflowId` or `objectId` not found in workspace |
| 404 | Linked `domainKey` or `packageKey` on workflow not found; include `missingRefs: string[]` |
| 409 | Package install key conflict when `failOnConflict: true` |
| 409 | Workflow execute while prior run still `running` (when single-flight enforced) |
| 403 | RBAC denial |
