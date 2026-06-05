# Observation System — Contracts

Authoritative shapes for `packages/shared-types`, new packages, and Prisma extensions. Implement exactly as specified unless the user amends this doc.

---

## Identifiers

- `observationId`: ULID, same as parent `memoryId` (one observation = one memory).
- `providerKey`, `metricKey`, `categoryKey`: lowercase slug `^[a-z][a-z0-9_]*$`.
- Provider keys: `website`, `pagespeed`, `google_business`, `facebook`, `instagram`, `tiktok`, `google_maps`, `google_search`, `facebook_ads`.

---

## Observation primitive

File: `packages/shared-types/src/observation-contracts.ts`

```ts
export type ObservationValue =
  | number
  | string
  | boolean
  | null
  | ObservationValue[]
  | { [key: string]: ObservationValue };

export interface ObservationMetadata {
  provider: string;
  category: string;
  metric: string;
  businessId?: string;
  competitorId?: string;
  platform?: string;
  collectedAt: string; // ISO-8601
  unit?: string;       // e.g. "ms", "count", "score_0_100"
  sourceLabel?: string;
}

export interface Observation {
  observationId: string;
  workspaceId: string;
  metric: string;
  value: ObservationValue;
  source: string;       // canonical source key, e.g. "google_business_profile"
  timestamp: string;  // ISO-8601 — when the fact was true in the world
  metadata: ObservationMetadata;
}
```

---

## Canonical memory extension

File: `packages/shared-types/src/canonical-memory-object.ts`

Add to `MemoryType`:

```ts
| "observation"
```

Add to `CanonicalMemoryMetadata`:

```ts
observation?: ObservationMetadata;

/** Set true on all observation memories — fast filter without parsing observation block */
isObservation?: boolean;
```

Observation memories use:

- `memoryType: "observation"`
- `sourceType: "json"`
- `persistenceMode: "persistent"`
- Single chunk containing stringified `{ metric, value, source, timestamp }`

---

## Observation filters (domain contract)

File: `packages/shared-types/src/observation-contracts.ts`

```ts
export interface ObservationFilter {
  providers?: string[];
  categories?: string[];
  metrics?: string[];
  platforms?: string[];
  businessId?: string;
  competitorId?: string;
  collectedAfter?: string;
  collectedBefore?: string;
}
```

Extend `Domain` in `domain-engine-contracts.ts`:

```ts
observationFilters: ObservationFilter[];
```

Default: `[]` (no observation scoping).

---

## Workflow context layer extension

File: `packages/shared-types/src/domain-engine-contracts.ts`

Add layer:

```ts
export type WorkflowContextLayer =
  | "globalFacts"
  | "domainFacts"
  | "instructions"
  | "objects"
  | "observations"        // NEW — after objects, before retrievedContext
  | "retrievedContext"
  | "previousWorkflowRuns";
```

Update `WORKFLOW_CONTEXT_LAYER_ORDER`:

```ts
["globalFacts", "domainFacts", "instructions", "objects", "observations", "retrievedContext", "previousWorkflowRuns"]
```

Extend `WorkflowExecutionContext`:

```ts
observations: NormalizedObservation[];
```

---

## Normalized observation (retrieval + LLM boundary)

This is the **only** observation shape downstream systems (workflow LLM, reports, dashboard) may consume.

```ts
export interface NormalizedObservation {
  observationId: string;
  provider: string;
  category: string;
  metric: string;
  value: ObservationValue;
  unit?: string;
  source: string;
  sourceLabel?: string;
  timestamp: string;
  collectedAt: string;
  businessId?: string;
  competitorId?: string;
  platform?: string;
}
```

Conversion: `normalizeObservationForContext(observation: Observation): NormalizedObservation` strips all fields not in this interface.

---

## Observation registry

File: `packages/shared-types/src/observation-contracts.ts`

```ts
export interface ObservationMetricDefinition {
  metricKey: string;
  categoryKey: string;
  providerKey: string;
  valueType: "number" | "string" | "boolean" | "object" | "array";
  unit?: string;
  description: string;
}

export interface ObservationProviderDefinition {
  providerKey: string;
  name: string;
  description: string;
  categories: string[];
  metrics: string[]; // metricKeys owned by this provider
  collectionInputSchema: Record<string, unknown>; // JSON Schema object
}
```

Package: `packages/observation-registry/`

| Function | Signature |
|----------|-----------|
| `registerProvider` | `(def: ObservationProviderDefinition) => void` |
| `registerMetric` | `(def: ObservationMetricDefinition) => void` |
| `validateObservation` | `(obs: Observation) => ValidationResult` |
| `normalizeObservation` | `(raw: unknown, providerKey: string) => Observation` |
| `listProviders` | `() => ObservationProviderDefinition[]` |
| `listMetrics` | `(filter?: { providerKey?: string; categoryKey?: string }) => ObservationMetricDefinition[]` |

---

## Observation provider interface

Package: `packages/observation-providers/`

```ts
export interface CollectInput {
  workspaceId: string;
  businessId?: string;
  competitorId?: string;
  traceId: string;
  params: Record<string, unknown>; // validated against provider collectionInputSchema
}

export interface CollectResult {
  providerKey: string;
  observations: Observation[];
  rawItemCount: number;
  collectedAt: string;
}

export interface ObservationProvider {
  definition: ObservationProviderDefinition;
  collect(input: CollectInput): Promise<CollectResult>;
}
```

Providers MUST NOT import from `@memory-middleware/domain-engine`.

---

## Package manifest extension

File: `packages/shared-types/src/domain-engine-contracts.ts`

Extend `PackageManifest`:

```ts
workflows?: PackageWorkflowRef[];

export interface PackageWorkflowRef {
  workflowKey: string;
  name: string;
  description?: string;
  domains: string[];       // domainKeys
  outputTypes: string[];   // e.g. ["report", "recommendations"]
  analysisSpecKey: string; // maps to LLM_ANALYSIS_CONTRACT workflow spec
}
```

---

## Prisma

### Migration: `observation_system_phase6`

Add to `Domain` model:

```prisma
observationFilters Json @default("[]") @map("observation_filters")
```

No new tables. Observations live in existing `memories` + `memory_chunks`.

### Optional index

Add GIN index on `memories.metadata` where `metadata->>'isObservation' = 'true'` if query performance requires it (Phase 10 exit criteria gate).

---

## Historian event types

File: `packages/shared-types/src/historian-contracts.ts` or observation-contracts

```ts
export const OBSERVATION_EVENT_TYPES = {
  OBSERVATION_CREATED: "observation_created",
  OBSERVATION_UPDATED: "observation_updated",
  OBSERVATION_ARCHIVED: "observation_archived",
  OBSERVATION_RETRIEVED: "observation_retrieved",
  OBSERVATION_COLLECTION_STARTED: "observation_collection_started",
  OBSERVATION_COLLECTION_COMPLETED: "observation_collection_completed",
  OBSERVATION_COLLECTION_FAILED: "observation_collection_failed",
} as const;
```

Payload must include: `observationId`, `workspaceId`, `provider`, `category`, `metric`, `traceId`.

---

## LLM analysis types

File: `packages/shared-types/src/workflow-analysis-contracts.ts`

See [LLM_ANALYSIS_CONTRACT.md](./LLM_ANALYSIS_CONTRACT.md) for full input/output schemas.

```ts
export interface WorkflowAnalysisInput {
  workflowKey: string;
  workflowName: string;
  query: string;
  businessId?: string;
  analysisSpecKey: string;
  globalFacts: Array<{ key: string; content: string }>;
  domainFacts: Array<{ domainKey: string; key: string; content: string }>;
  instructions: Array<{ domainKey: string; actionKey: string; content: string }>;
  objects: Array<{ objectType: string; name: string; metadata: Record<string, unknown> }>;
  observations: NormalizedObservation[];
  previousOutputs: Array<{ workflowRunId: string; title: string; outputType: string; summary: string }>;
}

export interface WorkflowAnalysisOutput {
  workflowKey: string;
  analysisSpecKey: string;
  generatedAt: string;
  findings: AnalysisFinding[];
  gaps: AnalysisGap[];
  recommendations: AnalysisRecommendation[];
  metadata: {
    observationCount: number;
    factCount: number;
    modelId: string;
    traceId: string;
  };
}
```

Individual finding/gap/recommendation shapes are defined per `analysisSpecKey` in LLM_ANALYSIS_CONTRACT.md.
