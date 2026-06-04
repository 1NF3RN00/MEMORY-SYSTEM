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
