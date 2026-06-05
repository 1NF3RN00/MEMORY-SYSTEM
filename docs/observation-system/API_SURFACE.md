# Observation System — API Surface

Routes to add in `apps/api/src/routes/`. Register in `apps/api/src/routes/index.ts`.

RBAC: follow [../domain-engine/RBAC.md](../domain-engine/RBAC.md). Collection and ingest require `workspace_admin` or API key with ingest scope.

---

## Observation providers

### `GET /observation-providers`

List registered providers from `ObservationRegistry`.

Response:

```json
{
  "providers": [
    {
      "providerKey": "facebook",
      "name": "Facebook Page",
      "categories": ["presence", "activity", "engagement"],
      "collectionInputSchema": { }
    }
  ]
}
```

### `GET /observation-metrics`

Query: `providerKey?`, `categoryKey?`

Response:

```json
{
  "metrics": [
    {
      "metricKey": "follower_count",
      "categoryKey": "presence",
      "providerKey": "facebook",
      "valueType": "number",
      "unit": "count"
    }
  ]
}
```

### `POST /observation-providers/:providerKey/collect`

Trigger collection for a workspace.

Body:

```json
{
  "workspaceId": "<ulid>",
  "businessId": "<optional slug>",
  "competitorId": "<optional slug>",
  "params": { }
}
```

`params` validated against provider `collectionInputSchema`.

Response `200`:

```json
{
  "providerKey": "facebook",
  "observationCount": 4,
  "observationIds": ["<ulid>", "..."],
  "collectedAt": "<ISO>"
}
```

Response `202` (async Apify run):

```json
{
  "runId": "<apify run id>",
  "status": "running",
  "pollUrl": "/observation-providers/facebook/runs/<runId>"
}
```

### `GET /observation-providers/:providerKey/runs/:runId`

Poll async collection status. On complete, includes `observationIds`.

---

## Observations

### `POST /observations`

Direct ingest of pre-normalized observations (bypasses provider collect). Used for testing and manual import.

Body:

```json
{
  "workspaceId": "<ulid>",
  "observations": [
    {
      "metric": "mobile_score",
      "value": 72,
      "source": "pagespeed_insights",
      "timestamp": "<ISO>",
      "metadata": {
        "provider": "pagespeed",
        "category": "performance",
        "metric": "mobile_score",
        "collectedAt": "<ISO>",
        "unit": "score_0_100"
      }
    }
  ]
}
```

Flow: validate via registry → store via observation-ingestion → emit `observation_created`.

### `POST /observations/validate`

Dry-run validation. No storage.

### `GET /observations`

Query:

| Param | Type | Description |
|-------|------|-------------|
| `workspaceId` | required | |
| `provider` | optional | |
| `category` | optional | |
| `metric` | optional | |
| `businessId` | optional | |
| `competitorId` | optional | |
| `collectedAfter` | optional | ISO date |
| `collectedBefore` | optional | ISO date |
| `limit` | optional | default 50, max 200 |
| `cursor` | optional | pagination |

Implementation: query `memories` where `metadata->>'isObservation' = 'true'` + JSON filters.

Response:

```json
{
  "observations": [ "<NormalizedObservation>" ],
  "nextCursor": "<optional>"
}
```

### `GET /observations/:observationId`

Returns `NormalizedObservation` + parent memory lineage.

---

## Domain extension

### `PATCH /domains/:domainId`

Add `observationFilters` to existing update body:

```json
{
  "observationFilters": [
    {
      "providers": ["website", "pagespeed"],
      "categories": ["technical_seo", "performance"]
    }
  ]
}
```

`GET /domains/:domainId` and list responses include `observationFilters`.

---

## Retrieval extension

### `POST /retrieve`

Existing body gains optional:

```json
{
  "observationOnly": false,
  "observationFilters": [ ]
}
```

When domain-scoped: merge domain `observationFilters` with request overrides.

Response `ContextPackage` gains:

```json
{
  "observations": [ "<NormalizedObservation>" ]
}
```

---

## Workflow extension

### `POST /workflows/:workflowId/execute`

No request change. Response outputs now include LLM analysis when workflow has `analysisSpecKey` in metadata.

`WorkflowOutput.data` contains `WorkflowAnalysisOutput` JSON.

### `GET /workflows/:workflowId`

Response includes `analysisSpecKey?: string` from workflow metadata.

---

## Package extension

### `POST /packages/install`

Manifest may include `workflows[]` per [PACKAGE_MANIFESTS.md](./PACKAGE_MANIFESTS.md).

---

## Event types

Emit via existing `EventEmitter`:

| Event | When |
|-------|------|
| `observation_created` | Memory stored |
| `observation_updated` | Value superseded (new memory version) |
| `observation_archived` | Memory archived |
| `observation_retrieved` | Included in retrieval or workflow context |
| `observation_collection_started` | Provider collect begins |
| `observation_collection_completed` | Provider collect succeeds |
| `observation_collection_failed` | Provider collect fails |
| `workflow_analysis_started` | LLM call begins |
| `workflow_analysis_completed` | Validated output |
| `workflow_analysis_failed` | Schema validation failed after retry |

---

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `APIFY_API_TOKEN` | For Apify providers | Apify API token |
| `PAGESPEED_API_KEY` | For pagespeed provider | Google PageSpeed Insights |
| `WORKFLOW_ANALYSIS_MODEL` | For Phase 8 | Model ID for structured analysis |
| `WORKFLOW_ANALYSIS_ENABLED` | Optional | `true` default when model set |
