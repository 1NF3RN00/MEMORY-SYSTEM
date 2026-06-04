# Domain Engine — Contracts & Schema (Phase 1)

Authoritative shapes for `packages/shared-types` and Prisma. Implement Phase 1 exactly as specified here unless the user amends this doc.

---

## Identifiers

- All entity IDs: **ULID** (application-assigned), consistent with `Memory`, `Workspace`.
- `domainKey`, `actionKey`, `packageKey`: stable lowercase slug strings (`^[a-z][a-z0-9-]*$`), unique per scope.

---

## TypeScript contracts

File: `packages/shared-types/src/domain-engine-contracts.ts`

### Operational roles

```ts
export type OperationalRole =
  | "middleware_admin"
  | "agency_admin"
  | "platform_admin"
  | "workspace_admin"
  | "workspace_user";
```

### Fact

```ts
export type FactScope = "global" | "domain";

export type FactStatus = "active" | "archived";

export interface Fact {
  factId: string;
  workspaceId: string;
  scope: FactScope;
  domainId?: string; // required when scope === "domain"
  key: string; // stable slug, e.g. "service-area-primary"
  title: string;
  content: string; // authoritative text
  priority: number; // higher wins within same scope; default 0
  status: FactStatus;
  /** Metadata keys this fact applies to when replacing chunk text */
  appliesToMetadataKeys?: string[];
  sourcePackageId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
```

### Instruction

```ts
export type InstructionStatus = "active" | "archived";

export interface Instruction {
  instructionId: string;
  workspaceId: string;
  domainId: string;
  actionKey: string; // e.g. "audit", "report"
  title: string;
  content: string;
  status: InstructionStatus;
  version: number;
  isActive: boolean; // one active version per (domainId, actionKey)
  sourcePackageId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
```

### Retrieval rules

```ts
export interface RetrievalRule {
  ruleId: string;
  domainId: string;
  name: string;
  /** Memory types eligible for this domain task */
  memoryTypes?: string[];
  /** Required metadata keys on memories (all must be present) */
  requiredMetadataKeys?: string[];
  /** Metadata key=value pairs that must match */
  metadataMatch?: Record<string, string | string[]>;
  /** Boost tags for ranking (deterministic additive weights) */
  rankingTagBoosts?: Record<string, number>;
  maxExpansionDepth?: number;
  tokenBudgetOverride?: number;
}

export interface RelationshipNeighborhoodConstraint {
  /** Allowed relationship types (Sprint relationship types) */
  allowedTypes?: string[];
  maxDepth: number; // default 1
  /** Target memory metadata keys required */
  targetMetadataKeys?: string[];
  maxNeighbors?: number;
}
```

### Domain

```ts
export type DomainStatus = "active" | "archived";

export interface Domain {
  domainId: string;
  workspaceId: string;
  domainKey: string;
  name: string;
  description?: string;
  status: DomainStatus;
  retrievalRules: RetrievalRule[];
  metadataFilters: string[];
  relationshipConstraints: RelationshipNeighborhoodConstraint;
  sourcePackageId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}
```

### Domain execution context

```ts
export interface DomainExecutionContext {
  workspaceId: string;
  domainId?: string;
  domainKey?: string;
  domainAction?: string;
  globalFacts: Fact[];
  domainFacts: Fact[];
  instructions: Instruction[]; // active instruction for domainAction when set
  retrievalRules: RetrievalRule[];
  metadataFilters: string[];
  relationshipConstraints: RelationshipNeighborhoodConstraint;
  resolvedAt: string;
}
```

### Fact override trace (admin-visible)

```ts
export interface FactOverrideRecord {
  factId: string;
  factScope: FactScope;
  factKey: string;
  memoryId: string;
  chunkId: string;
  originalExcerpt: string;
  replacementText: string;
  precedenceRank: number; // 1=global, 2=domain, 3=instruction
  reason: string; // deterministic explanation
}
```

### Package manifest

```ts
export interface PackageManifest {
  packageKey: string;
  name: string;
  version: string;
  description?: string;
  domains: Array<{
    domainKey: string;
    name: string;
    description?: string;
    retrievalRules: Omit<RetrievalRule, "ruleId" | "domainId">[];
    metadataFilters: string[];
    relationshipConstraints: RelationshipNeighborhoodConstraint;
    facts?: Array<Omit<Fact, "factId" | "workspaceId" | "domainId" | "version" | "createdAt" | "updatedAt">>;
    instructions?: Array<Omit<Instruction, "instructionId" | "workspaceId" | "domainId" | "version" | "createdAt" | "updatedAt" | "isActive">>;
  }>;
  globalFacts?: Array<Omit<Fact, "factId" | "workspaceId" | "domainId" | "version" | "createdAt" | "updatedAt">>;
  archiveRules?: Record<string, unknown>;
  metadataConfigs?: Record<string, unknown>;
}

export interface InstalledPackage {
  installedPackageId: string;
  workspaceId: string;
  packageDefinitionId: string;
  packageKey: string;
  installedVersion: string;
  snapshotVersion: string; // pin for rollback
  status: "active" | "archived";
  installedAt: string;
  archivedAt?: string;
  installedByUserId?: string;
}
```

### Extended retrieval query

Add to `RetrievalQuery` in `retrieval-contracts.ts`:

```ts
  domainKey?: string;
  domainAction?: string; // maps to instruction actionKey
```

### Extended context package metadata

```ts
export interface DomainContextMetadata {
  executionContext?: DomainExecutionContext;
  factOverrides: FactOverrideRecord[];
}
```

---

## Prisma models (Phase 1)

### Tenancy

```prisma
model Agency {
  id        String   @id
  name      String
  slug      String   @unique
  archived  Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  platforms Platform[]
  @@map("agencies")
}

model Platform {
  id        String   @id
  agencyId  String   @map("agency_id")
  name      String
  slug      String   @unique
  archived  Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  agency    Agency   @relation(fields: [agencyId], references: [id], onDelete: Cascade)
  workspaces Workspace[]
  @@index([agencyId])
  @@map("platforms")
}
```

**Workspace change:**

```prisma
  platformId String @map("platform_id")
  platform   Platform @relation(...)
```

### Domain engine entities

```prisma
model Domain {
  id                      String   @id
  workspaceId             String   @map("workspace_id")
  domainKey               String   @map("domain_key")
  name                    String
  description             String?
  status                  String   @default("active")
  metadataFilters         Json     @default("[]") @map("metadata_filters")
  relationshipConstraints Json     @default("{}") @map("relationship_constraints")
  sourcePackageId         String?  @map("source_package_id")
  archivedAt              DateTime? @map("archived_at")
  createdAt               DateTime @default(now()) @map("created_at")
  updatedAt               DateTime @updatedAt @map("updated_at")
  workspace               Workspace @relation(...)
  retrievalRules          DomainRetrievalRule[]
  facts                   DomainFact[]
  instructions            DomainInstruction[]
  @@unique([workspaceId, domainKey])
  @@index([workspaceId])
  @@map("domains")
}

model DomainRetrievalRule {
  id          String @id
  domainId    String @map("domain_id")
  name        String
  config      Json   @default("{}")
  sortOrder   Int    @default(0) @map("sort_order")
  domain      Domain @relation(...)
  @@index([domainId])
  @@map("domain_retrieval_rules")
}

model GlobalFact {
  id                   String   @id
  workspaceId          String   @map("workspace_id")
  key                  String
  title                String
  content              String
  priority             Int      @default(0)
  status               String   @default("active")
  appliesToMetadataKeys Json    @default("[]") @map("applies_to_metadata_keys")
  sourcePackageId      String?  @map("source_package_id")
  version              Int      @default(1)
  archivedAt           DateTime? @map("archived_at")
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")
  workspace            Workspace @relation(...)
  @@unique([workspaceId, key])
  @@index([workspaceId])
  @@map("global_facts")
}

model DomainFact {
  id                   String   @id
  workspaceId          String   @map("workspace_id")
  domainId             String   @map("domain_id")
  key                  String
  title                String
  content              String
  priority             Int      @default(0)
  status               String   @default("active")
  appliesToMetadataKeys Json    @default("[]") @map("applies_to_metadata_keys")
  sourcePackageId      String?  @map("source_package_id")
  version              Int      @default(1)
  archivedAt           DateTime? @map("archived_at")
  createdAt            DateTime @default(now()) @map("created_at")
  updatedAt            DateTime @updatedAt @map("updated_at")
  domain               Domain   @relation(...)
  @@unique([domainId, key])
  @@index([workspaceId])
  @@map("domain_facts")
}

model DomainInstruction {
  id              String   @id
  workspaceId     String   @map("workspace_id")
  domainId        String   @map("domain_id")
  actionKey       String   @map("action_key")
  title           String
  content         String
  status          String   @default("active")
  version         Int      @default(1)
  isActive        Boolean  @default(true) @map("is_active")
  sourcePackageId String?  @map("source_package_id")
  archivedAt      DateTime? @map("archived_at")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  domain          Domain   @relation(...)
  @@index([domainId, actionKey])
  @@index([workspaceId])
  @@map("domain_instructions")
}

model PackageDefinition {
  id          String   @id
  packageKey  String   @unique @map("package_key")
  name        String
  version     String
  description String?
  manifest    Json
  published   Boolean  @default(false)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  installations InstalledPackage[]
  @@map("package_definitions")
}

model InstalledPackage {
  id                   String   @id
  workspaceId          String   @map("workspace_id")
  packageDefinitionId  String   @map("package_definition_id")
  packageKey           String   @map("package_key")
  installedVersion     String   @map("installed_version")
  snapshotVersion      String   @map("snapshot_version")
  status               String   @default("active")
  manifestSnapshot     Json     @map("manifest_snapshot")
  installedByUserId    String?  @map("installed_by_user_id")
  installedAt          DateTime @default(now()) @map("installed_at")
  archivedAt           DateTime? @map("archived_at")
  workspace            Workspace @relation(...)
  packageDefinition    PackageDefinition @relation(...)
  @@index([workspaceId])
  @@map("installed_packages")
}
```

### Membership extension

```prisma
model WorkspaceMembership {
  // existing fields...
  operationalRole String? @map("operational_role") // OperationalRole enum string
}
```

### Platform user extension

```prisma
model PlatformUser {
  // existing...
  isMiddlewareAdmin Boolean @default(false) @map("is_middleware_admin")
  agencyId          String? @map("agency_id")   // when AgencyAdmin
  platformId        String? @map("platform_id") // when PlatformAdmin
}
```

Migration mapping:

| Existing | operationalRole |
|----------|-----------------|
| `isPlatformAdmin` true | `middleware_admin` |
| membership `owner` or `admin` | `workspace_admin` |
| membership `member` | `workspace_user` |

---

## Event types

```ts
export const DOMAIN_ENGINE_EVENT_TYPES = {
  GLOBAL_FACT_CREATED: "global_fact_created",
  GLOBAL_FACT_UPDATED: "global_fact_updated",
  GLOBAL_FACT_ARCHIVED: "global_fact_archived",
  GLOBAL_FACT_DELETED: "global_fact_deleted",
  DOMAIN_CREATED: "domain_created",
  DOMAIN_UPDATED: "domain_updated",
  DOMAIN_ARCHIVED: "domain_archived",
  DOMAIN_DELETED: "domain_deleted",
  DOMAIN_FACT_CREATED: "domain_fact_created",
  DOMAIN_FACT_UPDATED: "domain_fact_updated",
  DOMAIN_FACT_ARCHIVED: "domain_fact_archived",
  DOMAIN_FACT_DELETED: "domain_fact_deleted",
  INSTRUCTION_CREATED: "instruction_created",
  INSTRUCTION_VERSIONED: "instruction_versioned",
  INSTRUCTION_ARCHIVED: "instruction_archived",
  PACKAGE_INSTALLED: "package_installed",
  PACKAGE_EXPORTED: "package_exported",
  PACKAGE_UPDATED: "package_updated",
  PACKAGE_ARCHIVED: "package_archived",
  EXECUTION_CONTEXT_RESOLVED: "execution_context_resolved",
  FACT_OVERRIDE_APPLIED: "fact_override_applied",
} as const;
```

---

## Fact precedence algorithm (Phase 2/4)

Deterministic steps for `applyFactOverridesToMemories`:

1. Collect active facts: all global (workspace) + domain facts (if domain scoped), sorted by `priority` desc, then scope rank (global=1, domain=2).
2. Collect active instruction for `domainAction` if set (rank 3) — used for behavioral text, not chunk replacement unless marked as override type in future.
3. For each retrieved chunk, compute overlap between chunk `content` and fact `content` OR match `appliesToMetadataKeys` against chunk/memory metadata.
4. On conflict, **replace** overlapping span (or full chunk body if metadata key match) with fact `content`.
5. Emit one `FactOverrideRecord` per replacement.

Instructions do not replace facts. Retrieved context never wins over facts.

---

## Package install transaction (Phase 5)

Single Prisma transaction:

1. Validate manifest schema.
2. Upsert domains by `domainKey`.
3. Insert global facts (skip existing keys or fail — **fail on conflict** for safety).
4. Insert domain facts and instructions per domain.
5. Create `InstalledPackage` with full `manifestSnapshot`.
6. Emit `package_installed` event.

---

# Phase 8+ — Operational Objects, Workflows, and Workflow Runs

Authoritative shapes for Phase 8–11. Implement exactly as specified unless the user amends this doc or [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](../WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md).

File additions: extend `packages/shared-types/src/domain-engine-contracts.ts` (or `workflow-engine-contracts.ts` if split).

Imports from existing contracts:

```ts
import type { ContextPackage } from "./retrieval-contracts.js";
import type { Fact, Instruction, Domain, InstalledPackage } from "./domain-engine-contracts.js";
```

---

## Operational Object

```ts
export type OperationalObjectStatus = "active" | "archived";

export interface OperationalObject {
  objectId: string;
  workspaceId: string;
  /** Free-form slug, e.g. customer, competitor, campaign — never enum-enforced in middleware */
  objectType: string;
  name: string;
  /** Free-form status string — never enum-enforced in middleware */
  status: string;
  metadata: Record<string, unknown>;
  objectStatus: OperationalObjectStatus; // row lifecycle (active/archived), not business status
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateOperationalObjectInput {
  workspaceId: string;
  objectType: string;
  name: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateOperationalObjectInput {
  name?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface ListOperationalObjectsQuery {
  workspaceId: string;
  objectType?: string;
  status?: string;
  metadataMatch?: Record<string, string | string[]>;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
}
```

**Rules:**

- Middleware never validates `objectType` or business `status` against a fixed enum.
- `objectStatus` is the only enforced lifecycle field (`active` | `archived`).
- Objects are searchable by `objectType`, `status`, and JSON metadata keys.

---

## Workflow

```ts
export interface WorkflowInstructionRef {
  domainKey: string;
  actionKey: string;
}

export interface Workflow {
  workflowId: string;
  workspaceId: string;
  name: string;
  description: string;
  /** domainKey slugs resolved at execution time */
  domains: string[];
  /** installed packageKey slugs — expands to manifest domains/facts/instructions */
  packages: string[];
  /** Explicit instruction refs; merged with domain default actions when empty */
  instructionRefs: WorkflowInstructionRef[];
  /** Configurable output type labels, e.g. report, insight, recommendation */
  outputTypes: string[];
  /** Optional objectType filters applied when resolving execution context */
  objectTypeFilters?: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateWorkflowInput {
  workspaceId: string;
  name: string;
  description?: string;
  domains?: string[];
  packages?: string[];
  instructionRefs?: WorkflowInstructionRef[];
  outputTypes?: string[];
  objectTypeFilters?: string[];
}

export interface UpdateWorkflowInput {
  name?: string;
  description?: string;
  domains?: string[];
  packages?: string[];
  instructionRefs?: WorkflowInstructionRef[];
  outputTypes?: string[];
  objectTypeFilters?: string[];
  active?: boolean;
}
```

---

## Workflow output

```ts
export type WorkflowOutputType = string; // free-form label from workflow.outputTypes

export interface WorkflowOutput {
  outputId: string;
  workflowRunId: string;
  workspaceId: string;
  outputType: WorkflowOutputType;
  title: string;
  content: string;
  /** Structured payload for machine consumption */
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
```

Workflow outputs are persisted and indexed for retrieval by future runs.

---

## Workflow run

```ts
export type WorkflowRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "archived";

export interface WorkflowRun {
  workflowRunId: string;
  workflowId: string;
  workspaceId: string;
  status: WorkflowRunStatus;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  /** Denormalized counts; full entities in replay payload */
  outputCount: number;
  generatedFactIds: string[];
  generatedMemoryIds: string[];
  generatedObjectIds: string[];
  archivedAt?: string;
}

/** Full run detail for API GET and Historian replay */
export interface WorkflowRunDetail extends WorkflowRun {
  outputs: WorkflowOutput[];
  generatedFacts: Fact[];
  generatedObjects: OperationalObject[];
  executionContext: WorkflowExecutionContext;
}
```

---

## Workflow execution context

```ts
export interface WorkflowExecutionContext {
  workflowId: string;
  workflowRunId?: string;
  workspaceId: string;
  domains: Domain[];
  packages: InstalledPackage[];
  globalFacts: Fact[];
  domainFacts: Fact[];
  instructions: Instruction[];
  objects: OperationalObject[];
  retrievedContext: ContextPackage[];
  /** Prior completed runs for same workflowId, newest first, capped by config */
  previousWorkflowRuns: WorkflowRunDetail[];
  resolvedAt: string;
}

/** Snapshot stored on ReplaySnapshot.payload for workflow runs */
export interface WorkflowReplayPayload {
  workflowId: string;
  workflowRunId: string;
  workspaceId: string;
  executionContext: WorkflowExecutionContext;
  outputs: WorkflowOutput[];
  generatedFactIds: string[];
  generatedMemoryIds: string[];
  generatedObjectIds: string[];
  domainKey?: string;
  domainAction?: string;
}
```

---

## Workflow retrieval precedence (Phase 9/10)

When assembling workflow input, materialize sections in this order (mandatory):

1. Global facts
2. Domain facts
3. Instructions
4. Operational objects (metadata + status summaries)
5. Retrieved context (`ContextPackage[]` from linked domains)
6. Previous workflow runs (outputs + generated artifacts from prior runs)

Facts always win over all lower layers. This extends — does not replace — domain-scoped retrieval precedence in Phase 2/4.

---

## Extended retrieval rule (optional Phase 8)

Add optional fields to `RetrievalRule`:

```ts
  /** When set, include operational objects of these types in domain scope */
  objectTypeFilter?: string[];
  objectMetadataMatch?: Record<string, string | string[]>;
```

---

## Prisma models (Phase 8+)

```prisma
model OperationalObject {
  id          String   @id
  workspaceId String   @map("workspace_id")
  objectType  String   @map("object_type")
  name        String
  status      String   // business status — free-form string
  metadata    Json     @default("{}")
  rowStatus   String   @default("active") @map("row_status") // active | archived
  archivedAt  DateTime? @map("archived_at")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  @@index([workspaceId, objectType])
  @@index([workspaceId, status])
  @@map("operational_objects")
}

model Workflow {
  id                String   @id
  workspaceId       String   @map("workspace_id")
  name              String
  description       String   @default("")
  domains           Json     @default("[]")      // string[] domainKeys
  packages          Json     @default("[]")      // string[] packageKeys
  instructionRefs   Json     @default("[]") @map("instruction_refs")
  outputTypes       Json     @default("[]") @map("output_types")
  objectTypeFilters Json     @default("[]") @map("object_type_filters")
  active            Boolean  @default(true)
  archivedAt        DateTime? @map("archived_at")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  workspace         Workspace @relation(...)
  runs              WorkflowRun[]
  @@index([workspaceId])
  @@map("workflows")
}

model WorkflowRun {
  id                  String   @id
  workflowId          String   @map("workflow_id")
  workspaceId         String   @map("workspace_id")
  status              String   @default("pending")
  startedAt           DateTime @default(now()) @map("started_at")
  completedAt         DateTime? @map("completed_at")
  errorMessage        String?  @map("error_message")
  outputCount         Int      @default(0) @map("output_count")
  generatedFactIds    Json     @default("[]") @map("generated_fact_ids")
  generatedMemoryIds  Json     @default("[]") @map("generated_memory_ids")
  generatedObjectIds  Json     @default("[]") @map("generated_object_ids")
  executionContext    Json?    @map("execution_context") // WorkflowExecutionContext snapshot
  archivedAt          DateTime? @map("archived_at")
  workflow            Workflow @relation(...)
  outputs             WorkflowOutput[]
  @@index([workflowId])
  @@index([workspaceId])
  @@map("workflow_runs")
}

model WorkflowOutput {
  id            String   @id
  workflowRunId String   @map("workflow_run_id")
  workspaceId   String   @map("workspace_id")
  outputType    String   @map("output_type")
  title         String
  content       String
  data          Json?
  metadata      Json?
  createdAt     DateTime @default(now()) @map("created_at")
  workflowRun   WorkflowRun @relation(...)
  @@index([workflowRunId])
  @@index([workspaceId, outputType])
  @@map("workflow_outputs")
}
```

Add relations on `Workspace`:

```prisma
  operationalObjects OperationalObject[]
  workflows          Workflow[]
```

Link generated facts/memories/objects to runs via optional nullable fields (Phase 10 migration):

```prisma
  sourceWorkflowRunId String? @map("source_workflow_run_id") // on GlobalFact, DomainFact, Memory as applicable
```

---

## Event types (Phase 8+)

```ts
export const OPERATIONAL_OBJECT_EVENT_TYPES = {
  OPERATIONAL_OBJECT_CREATED: "operational_object_created",
  OPERATIONAL_OBJECT_UPDATED: "operational_object_updated",
  OPERATIONAL_OBJECT_ARCHIVED: "operational_object_archived",
  OPERATIONAL_OBJECT_DELETED: "operational_object_deleted",
} as const;

export const WORKFLOW_ENGINE_EVENT_TYPES = {
  WORKFLOW_CREATED: "workflow_created",
  WORKFLOW_UPDATED: "workflow_updated",
  WORKFLOW_ARCHIVED: "workflow_archived",
  WORKFLOW_STARTED: "workflow_started",
  WORKFLOW_CONTEXT_BUILT: "workflow_context_built",
  WORKFLOW_RETRIEVAL_COMPLETED: "workflow_retrieval_completed",
  WORKFLOW_EXECUTION_COMPLETED: "workflow_execution_completed",
  WORKFLOW_FAILED: "workflow_failed",
  WORKFLOW_OUTPUT_GENERATED: "workflow_output_generated",
  WORKFLOW_RUN_ARCHIVED: "workflow_run_archived",
} as const;
```

Merge into Historian `EventLog` with structured payloads:

| Event | Minimum payload fields |
|-------|------------------------|
| `workflow_started` | `workflowId`, `workflowRunId`, `workspaceId` |
| `workflow_context_built` | `workflowRunId`, `executionContext` (full snapshot) |
| `workflow_retrieval_completed` | `workflowRunId`, `retrievedContextCount`, `domainKeys[]` |
| `workflow_execution_completed` | `workflowRunId`, `outputCount`, `durationMs` |
| `workflow_failed` | `workflowRunId`, `errorMessage`, `stage` |
| `workflow_output_generated` | `workflowRunId`, `outputId`, `outputType` |
| `workflow_run_archived` | `workflowRunId` |

`ReplaySnapshot.payload` for workflow operations uses `WorkflowReplayPayload`.

---

## Workflow execute transaction (Phase 10)

Single logical transaction (may span async steps with status updates):

1. Create `WorkflowRun` with `status: running`.
2. Emit `workflow_started`.
3. Resolve `WorkflowExecutionContext`; emit `workflow_context_built`.
4. Run retrieval per linked domains/packages; emit `workflow_retrieval_completed`.
5. Invoke generation; persist `WorkflowOutput` rows; emit `workflow_output_generated` per output.
6. Persist generated facts/memories/objects with `sourceWorkflowRunId`.
7. Update run with `executionContext` snapshot, IDs, `status: completed`; emit `workflow_execution_completed`.
8. On failure: set `status: failed`, emit `workflow_failed` — partial outputs remain observable.

Prior runs for same `workflowId` loaded with configurable limit (default **10**, newest first).

