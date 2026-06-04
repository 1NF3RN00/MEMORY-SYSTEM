# DOMAIN ENGINE AND PACKAGE SYSTEM

> **Implementation guide:** [docs/domain-engine/README.md](./domain-engine/README.md) — phased build instructions, contracts, and API surface.  
> **How to create domains and packages:** [docs/domain-engine/CREATE_DOMAINS_AND_PACKAGES.md](./domain-engine/CREATE_DOMAINS_AND_PACKAGES.md)  
> **Workflows and operational objects:** [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](./WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md)

## Purpose

The Domain Engine is the **retrieval operator layer** above middleware retrieval infrastructure.

The middleware is intentionally domain-agnostic.

The middleware does not understand:

* SEO
* Competitor Analysis
* Inbox Management
* Strategy
* Marketing

Those are implemented through Domains and Packages.

A Domain is a task-scoped retrieval operator.

Domains **do not own data**. Domains define:

* retrieval rules
* metadata filters
* fact references
* instruction references
* retrieval boundaries

The middleware retrieves information.

Domains determine **where and how** retrieval should occur.

**Workflows** (see [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](./WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md)) consume domain configuration to execute intelligence processes. Domains retrieve; workflows execute.

---

# Core Hierarchy

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

Domain-scoped retrieval uses: **Global Facts → Domain Facts → Instructions → Retrieved Context**.

Workflow execution extends precedence with **Operational Objects** and **Previous Workflow Runs** (see workflow spec).

---

# Workspace

A Workspace represents a single contextual intelligence environment.

Examples:

* Acme HVAC
* Midgley Solutions
* ABC Law Firm

Workspaces contain:

* Sources (ingestion origins)
* Operational Objects
* Global Facts
* Domains
* Packages
* Memories
* Workflows
* Users

---

# Global Facts

Global Facts are universal truths for a workspace.

Examples:

* service areas
* business hours
* active promotions
* company policies
* legal constraints

Global Facts always have highest priority.

Global Facts are available to all domains.

Global Facts always override:

* instructions
* retrieved context
* website content

Precedence:

Global Facts
→ Domain Facts
→ Instructions
→ Retrieved Context

---

# Domains

Domains are task-scoped retrieval operators.

Examples:

SEO Domain
Competitor Domain
Inbox Domain
Strategy Domain

Domains are NOT categories.

Domains are NOT execution engines — workflows execute; domains retrieve.

Domains define:

* retrieval boundaries
* retrieval rules
* metadata filters
* instruction references
* fact references

Domains answer: **"Where should we retrieve information from?"**

---

# Domain Facts

Domain Facts apply only to a specific domain.

Example:

SEO Domain:
"Target keyword: HVAC North Haven"

Inbox Domain:
"Escalate pricing questions to sales"

Domain Facts override:

* instructions
* retrieved context

But never override Global Facts.

---

# Instructions

Instructions describe how a domain should operate.

Examples:

SEO:
"Prioritize current website content and ranking opportunities."

Competitor Analysis:
"Compare service offerings and identify differentiation opportunities."

Instructions are contextual behavior definitions.

Instructions are workspace editable.

Instructions are versioned.

---

# Memories

Memories remain middleware retrieval objects.

Domains scope memory access.

Domains determine:

* what memories are eligible
* what metadata is required
* what retrieval boundaries exist

Memories are not owned by domains — domains filter and shape retrieval against workspace memories.

---

# Operational Objects

Operational Objects organize real-world entities (customers, competitors, campaigns, etc.) with configurable `objectType`, `status`, and metadata.

Objects participate in retrieval but are **not** memories.

Domains and workflows may reference objects in retrieval scope.

See [WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md](./WORKFLOW_ENGINE_AND_OPERATIONAL_OBJECTS.md).

---

# Retrieval Rules

Domains define retrieval behavior.

Examples:

SEO Domain:

* website metadata
* keyword metadata
* seo-tagged content

Competitor Domain:

* competitor metadata
* competitor crawl data

Inbox Domain:

* customer information
* policies
* promotions
* strategy

Tools should never define retrieval rules.

Domains define retrieval rules.

---

# Domain Execution Context

```ts
type DomainExecutionContext = {
  workspaceId: string;

  domainId: string;

  globalFacts: Fact[];

  domainFacts: Fact[];

  instructions: Instruction[];

  retrievalRules: RetrievalRule[];

  metadataFilters: string[];

  relationships: Relationship[];
};
```

This becomes the primary object passed into execution pipelines.

---

# Packages

Packages are installable **retrieval bundles**.

Packages may contain:

* Domains
* Instructions
* Facts
* Retrieval Rules
* Metadata Rules
* Archive Rules

Packages contain **no execution logic**.

Packages are reusable.

Packages are exportable.

Packages are versioned.

---

# Package Installation

Installing a package may:

* create domains
* create instructions
* create facts
* create retrieval configurations
* create metadata configurations

A package should be installable in one operation.

---

# Package Updates

Package updates are never automatic.

Workspace Admins approve updates.

Installed packages become workspace-owned.

---

# Fact Precedence

Required order:

Global Facts
→ Domain Facts
→ Instructions
→ Retrieved Context

This precedence is mandatory.

Any contradiction resolves upward.

Facts always win.
