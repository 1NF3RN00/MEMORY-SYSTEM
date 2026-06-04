# WORKFLOW ENGINE AND OPERATIONAL OBJECTS

> **Implementation guide:** [docs/domain-engine/README.md](./domain-engine/README.md) — phased build (Phase 8+).  
> **Contracts:** [docs/domain-engine/CONTRACTS.md](./domain-engine/CONTRACTS.md) — Phase 8+ types and Prisma models.  
> **API surface:** [docs/domain-engine/API_SURFACE.md](./domain-engine/API_SURFACE.md) — workflow and object routes.  
> **Domain retrieval layer:** [DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md](./DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md).

> **Not the same as orchestration workflows.** [docs/api/workflow-api.md](./api/workflow-api.md) and [docs/configuration/workflow-configs.md](./configuration/workflow-configs.md) describe **deterministic orchestration** (retries, escalation, routing). This document describes **operational intelligence workflows** — executable processes that consume retrieved context and produce persistent, replayable outputs.

---

## Purpose

The Workflow Engine and Operational Object System exist to transform the middleware from a retrieval engine into an **operational intelligence platform**.

The middleware remains retrieval-first.

The middleware is **not**:

* a CRM
* an ERP
* a project manager
* a business operating system

Instead:

The middleware provides operational intelligence infrastructure that enables workflows to retrieve, analyze, and evolve information over time.

---

## Core Principle

Information is stored once.

Information is retrieved many times.

Workflows do not own information.

Workflows retrieve information.

Objects organize information.

Domains retrieve information.

Packages bundle retrieval capability.

The middleware remains retrieval-centric.

---

## Updated Architecture Hierarchy

```txt
Agency
  ↓
Platform
  ↓
Workspace
  ↓
Sources
  ↓
Operational Objects
  ↓
Facts
  ↓
Memories
  ↓
Domains
  ↓
Domain Packages
  ↓
Workflows
  ↓
Workflow Runs
  ↓
Applications
```

**Layer roles:**

| Layer | Role |
|-------|------|
| **Sources** | Ingestion origins (websites, uploads, integrations) — feed memories |
| **Operational Objects** | Metadata-driven entities that organize real-world things |
| **Facts** | Authoritative truths (global or domain-scoped) |
| **Memories** | Middleware retrieval objects |
| **Domains** | Task-scoped retrieval operators |
| **Domain Packages** | Installable retrieval bundles (no execution logic) |
| **Workflows** | Executable intelligence processes |
| **Workflow Runs** | Observable, replayable execution records |
| **Applications** | User-facing surfaces that invoke workflows |

---

## Operational Objects

Operational Objects represent real-world entities that evolve over time.

Examples:

* Customer
* Competitor
* Product
* Service
* Promotion
* Campaign
* Location
* Vendor
* Partner
* Asset

Operational Objects are **not** memories.

Operational Objects are metadata-driven organizational entities.

### Definition

```ts
type OperationalObject = {
  objectId: string;
  workspaceId: string;
  objectType: string;
  name: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};
```

Operational Objects remain flexible.

The middleware should **never** hardcode object types.

---

## Dynamic Status Architecture

Status is metadata.

Status does not belong to workflows.

Status does not belong to domains.

Status belongs to objects.

Examples:

| Object type | Example status values |
|-------------|----------------------|
| Customer | `lead`, `client`, `past-client`, `lost` |
| Competitor | `active`, `watchlist`, `archived` |
| Promotion | `active`, `scheduled`, `expired` |
| Campaign | `draft`, `active`, `paused`, `completed` |

Status must remain fully configurable.

The middleware should **never** enforce status values.

---

## Object Metadata

Objects support arbitrary metadata.

Example (Customer):

```json
{
  "industry": "HVAC",
  "region": "Connecticut",
  "customerValue": "high",
  "lastContacted": "2026-06-04"
}
```

Objects become searchable retrieval surfaces.

---

## Object Retrieval

Objects participate in retrieval.

Objects may provide:

* metadata
* status
* facts
* relationships

Objects may be referenced by:

* domains
* workflows
* packages

Objects should never replace memories.

Objects augment retrieval.

---

## Domains

Domains remain retrieval operators.

Domains do not own data.

Domains define:

* retrieval rules
* metadata filters
* fact references
* instruction references
* retrieval boundaries

Domains answer:

> "Where should we retrieve information from?"

### Examples

| Domain | Retrieves |
|--------|-----------|
| Website | website content, crawl outputs, website metadata |
| Competitor | competitor objects, competitor sources, competitor facts |
| Knowledge | uploaded documents, notes, SOPs, internal knowledge |
| Customer | customer objects, customer facts, customer history, communications |

Domains remain task-shaped retrieval operators.

See [DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md](./DOMAIN_ENGINE_AND_PACKAGE_SYSTEM.md) for domain and package configuration.

---

## Domain Packages

Packages are retrieval bundles.

Packages contain:

* domains
* instructions
* facts
* retrieval configuration
* metadata rules

Packages contain **no execution logic**.

Packages exist to simplify retrieval composition.

### Example: Marketing Package

Contains Strategy, Brand, Website, Competitor, and Product domains.

This package defines retrieval capability — not execution behavior.

---

## Workflows

Workflows are executable intelligence processes.

Workflows consume:

* domains
* packages
* facts
* instructions
* memories
* objects

Workflows produce:

* outputs
* insights
* recommendations
* generated facts
* generated memories

Workflows answer:

> "What should we do with retrieved information?"

### Definition

```ts
type Workflow = {
  workflowId: string;
  workspaceId: string;
  name: string;
  description: string;
  domains: string[];       // domainKey references
  packages: string[];        // packageKey references
  instructions: string[];    // instructionId or (domainKey + actionKey) refs
  outputTypes: string[];     // configurable output type labels
  active: boolean;
};
```

---

## Workflow Execution Philosophy

Workflows are persistent.

Workflows are not one-time retrieval operations.

Each workflow execution becomes future context.

Example — Competitor Analysis:

| Run | Behavior |
|-----|----------|
| **Run #1** | Analyzes competitors; generates findings |
| **Run #2** | Retrieves previous findings; analyzes changes; identifies deltas |

The workflow becomes progressively more intelligent through retrieval — not through hidden memory.

---

## Workflow Runs

Every execution creates a Workflow Run.

Workflow Runs are:

* replayable
* observable
* retrievable

### Definition

```ts
type WorkflowRun = {
  workflowRunId: string;
  workflowId: string;
  workspaceId: string;
  startedAt: string;
  completedAt?: string;
  status: WorkflowRunStatus;
  outputs: WorkflowOutput[];
  generatedFacts: Fact[];
  generatedMemories: Memory[];
  generatedObjects: OperationalObject[];
};
```

---

## Workflow Output Persistence

Workflow outputs become retrieval candidates.

Workflow outputs should be:

* searchable
* retrievable
* replayable
* observable

This allows future workflow executions to learn from prior work.

---

## Workflow Execution Context

```ts
type WorkflowExecutionContext = {
  workflowId: string;
  workspaceId: string;
  domains: Domain[];
  packages: DomainPackage[];
  globalFacts: Fact[];
  domainFacts: Fact[];
  instructions: Instruction[];
  objects: OperationalObject[];
  retrievedContext: ContextPackage[];
  previousWorkflowRuns: WorkflowRun[];
};
```

This becomes the primary workflow input.

Built by `resolveWorkflowExecutionContext()` (Phase 9).

---

## Workflow Retrieval Order

Required precedence:

```txt
Global Facts
  ↓
Domain Facts
  ↓
Instructions
  ↓
Operational Objects
  ↓
Retrieved Context
  ↓
Previous Workflow Runs
```

This order is **mandatory** for workflow execution.

Facts always win.

**Domain-scoped retrieval** (without a workflow) uses the shorter chain defined in the Domain Engine:

```txt
Global Facts → Domain Facts → Instructions → Retrieved Context
```

See [CREATE_DOMAINS_AND_PACKAGES.md](./domain-engine/CREATE_DOMAINS_AND_PACKAGES.md).

---

## Workflow Memory

Workflows never maintain hidden state.

All persistence occurs through:

* facts
* memories
* objects
* workflow runs

This ensures:

* replayability
* observability
* deterministic behavior

Aligned with [OPERATIONAL_HISTORIAN_REPLAY_SYSTEM.md](./OPERATIONAL_HISTORIAN_REPLAY_SYSTEM.md).

---

## Workflow Observability

Every workflow execution must emit Historian events:

| Event | When |
|-------|------|
| `workflow_started` | Execution begins |
| `workflow_context_built` | `WorkflowExecutionContext` resolved |
| `workflow_retrieval_completed` | All domain/package retrieval finished |
| `workflow_execution_completed` | LLM/processing step finished |
| `workflow_failed` | Unrecoverable error |
| `workflow_output_generated` | Each output persisted |
| `workflow_run_archived` | Run archived (soft) |

All events should be replayable through Historian.

`ReplaySnapshot.payload` for workflow runs must include serialized `WorkflowExecutionContext`, outputs, and generated entity IDs.

---

## Dashboard Integration

The dashboard should expose (Phase 11):

| Surface | Purpose |
|---------|---------|
| Workflow Registry | CRUD workflows; link domains/packages |
| Workflow Runs | List and inspect runs |
| Workflow Outputs | Searchable output browser |
| Workflow History | Timeline per workflow |
| Workflow Observability | Event trace per run |
| Workflow Performance | Duration, token, retrieval stats |
| Workflow Replay | Reconstruct run from Historian snapshot |

Users interact with **workflows**, not retrieval pipelines.

Operational Object Manager (Phase 8): `/objects` — CRUD by `objectType`, filter by status/metadata.

---

## Core Principle

Domains retrieve.

Packages bundle.

Objects organize.

Facts constrain.

Instructions guide.

Workflows execute.

The middleware remains retrieval-first.

Everything else exists to improve retrieval quality and operational intelligence.
