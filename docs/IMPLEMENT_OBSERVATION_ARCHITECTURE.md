# IMPLEMENT_OBSERVATION_ARCHITECTURE.md

> **Implementation guide:** Exact build steps, contracts, and LLM analysis spec live in [observation-system/](./observation-system/README.md).

## Objective

Integrate the Observation Architecture into the existing Middleware without breaking:

* Memory Objects
* Retrieval Engine
* Domains
* Packages
* Workflows
* Observability
* Historian
* Workspace Isolation

This is an additive enhancement.

No existing retrieval functionality should regress.

---

# Existing Reality

Current Architecture:

Sources
↓
Memory Objects
↓
Chunks
↓
Retrieval
↓
Context Package

New Architecture:

Observation Providers
↓
Observations
↓
Memory Objects
↓
Domains
↓
Workflows
↓
Business Outputs

---

# Phase 1

## Create Observation Primitive

Add:

```ts
type Observation = {
  observationId: string;

  workspaceId: string;

  metric: string;

  value: unknown;

  source: string;

  timestamp: string;

  metadata: ObservationMetadata;
}
```

---

Observation is not a replacement for Memory.

Observation becomes a first-class ingestion surface.

---

# Phase 2

## Observation Metadata

Extend existing CanonicalMemoryMetadata.

Add:

```ts
observation?: {
  provider: string;

  category: string;

  metric: string;

  businessId?: string;

  competitorId?: string;

  platform?: string;

  collectedAt: string;
}
```

Examples:

```ts
provider = "facebook"
category = "engagement"
metric = "average_comments"
```

```ts
provider = "website"
category = "technical_seo"
metric = "schema_present"
```

---

# Phase 3

## Observation Registry

Create:

```ts
ObservationRegistry
```

Responsibilities:

* provider registration
* schema validation
* normalization
* metric definitions

API:

```ts
registerProvider()

registerMetric()

validateObservation()

normalizeObservation()
```

---

# Phase 4

## Observation Storage

Observations become Memory Objects.

No separate storage layer.

No duplicate database.

Observations inherit:

* embeddings
* metadata
* retrieval
* observability
* historian

Benefits:

* zero architecture duplication
* immediate retrieval compatibility

---

# Phase 5

## Retrieval Enhancement

Add retrieval mode:

```ts
observation
```

Context builder must support:

```ts
retrieveObservations()
```

using:

* metadata filters
* metric filters
* provider filters

---

# Phase 6

## Domain Integration

Domains retrieve observations.

Domains never own observations.

Add:

```ts
observationFilters
```

to DomainDefinition.

Example:

```ts
SEO Domain

provider:
- website
- pagespeed

categories:
- technical_seo
- metadata
- content
```

---

# Phase 7

## Workflow Integration

Workflows consume Domains.

Workflows never consume providers.

Workflow:

SEO Audit

↓

SEO Domain

↓

Observations

↓

Report

---

# Phase 8

## Dashboard

Add:

Observation Explorer

Displays:

* provider
* category
* metric
* value
* source
* timestamp

Filtering:

* workspace
* domain
* provider
* metric

---

# Phase 9

## Historian

All observation lifecycle events:

observation_created

observation_updated

observation_archived

observation_retrieved

must be replayable.

---

# Success Criteria

The middleware should support:

Website Provider
PageSpeed Provider
Google Business Provider
Facebook Provider
Instagram Provider
TikTok Provider

without creating new retrieval systems.

Everything remains retrieval-first.

Domains retrieve.

Workflows execute.

Observations provide facts.
