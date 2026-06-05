# DOMAINS_PACKAGES_WORKFLOWS_SPEC.md

NOTE: DO NOT HARDCODE THIS LOGIC INTO THE SYSTEM. CREATE A SEPERATE DOCUMENT TO INSTALL THIS PACKAGE INTO THE EXISTING SYSTEM

## Purpose

Define the permanent architecture contract for:

* Domains
* Domain Packages
* Workflows

These are middleware primitives.

Applications consume them.

---

# Domain

A Domain is a retrieval boundary.

Domains do not own data.

Domains define:

* retrieval scope
* metadata scope
* fact scope
* instruction scope

---

## Domain Contract

```ts
type Domain = {
  domainId: string;

  key: string;

  name: string;

  description: string;

  metadataFilters: string[];

  observationFilters: ObservationFilter[];

  retrievalRules: RetrievalRule[];

  factReferences: string[];

  instructionReferences: string[];
}
```

---

# Core Domains

Initial Middleware Domains:

```text
strategy
brand
knowledge
website
competitor
customer
product
sales
operations
reputation
social
```

---

# Package

A Package is a reusable retrieval bundle.

Packages contain:

* domains
* facts
* instructions
* workflows

Packages do not contain memory.

Packages do not contain observations.

Packages reference existing infrastructure.

---

## Package Contract

```ts
type DomainPackage = {
  packageId: string;

  key: string;

  name: string;

  domains: string[];

  facts: string[];

  instructions: string[];

  workflows: string[];
}
```

---

# Example

Marketing Package

Contains:

* strategy
* brand
* website
* competitor
* product

---

# Workflow

Workflows are executable business processes.

Workflows consume:

* domains
* packages
* facts
* instructions
* observations

Workflows produce:

* outputs
* recommendations
* reports
* insights

---

## Workflow Contract

```ts
type Workflow = {
  workflowId: string;

  key: string;

  name: string;

  description: string;

  domains: string[];

  packages: string[];

  outputs: string[];

  active: boolean;
}
```

---

# Workflow Runs

Workflows are persistent.

Every execution creates:

```ts
WorkflowRun
```

Workflow outputs become future retrieval context.

---

# Workflow Run Contract

```ts
type WorkflowRun = {
  workflowRunId: string;

  workflowId: string;

  workspaceId: string;

  outputs: WorkflowOutput[];

  generatedFacts: Fact[];

  generatedMemories: Memory[];

  generatedObjects: OperationalObject[];

  createdAt: string;
}
```

---

# Workflow Retrieval Order

Mandatory:

Global Facts

↓

Domain Facts

↓

Instructions

↓

Operational Objects

↓

Observations

↓

Retrieved Context

↓

Previous Workflow Runs

Facts always win.

---

# Execution Flow

Workflow

↓

Domain Retrieval

↓

Observation Retrieval

↓

Context Assembly

↓

Execution

↓

Output Generation

↓

Historian

↓

Future Retrieval

---

# Package Registry

Required APIs:

```ts
createPackage()

updatePackage()

archivePackage()

installPackage()

exportPackage()
```

---

# Workflow Registry

Required APIs:

```ts
createWorkflow()

updateWorkflow()

executeWorkflow()

archiveWorkflow()

replayWorkflow()
```

---

# Middleware Principle

Observations create facts.

Domains retrieve facts.

Packages bundle capability.

Workflows create outcomes.

Applications consume outcomes.

This architecture must remain deterministic, explainable, observable, and retrieval-first.
