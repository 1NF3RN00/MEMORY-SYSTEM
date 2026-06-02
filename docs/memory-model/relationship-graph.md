# Interface Contract Specification

## Overview

The middleware exposes:
universal semantic infrastructure interfaces.

Interfaces are consumers of:

* memory
* retrieval
* orchestration
* context assembly
* compression
* analytics

Interfaces do not own:

* retrieval logic
* orchestration logic
* memory systems
* governance systems
* compression systems

The middleware remains:
the central intelligence infrastructure layer.

---

# Core Philosophy

Interfaces are presentation and interaction layers.

The middleware owns:

* semantic memory
* retrieval
* ranking
* governance
* orchestration
* compression
* context assembly

Interfaces consume:
middleware intelligence services.

The middleware architecture is:
interface-agnostic.

---

# Supported Interface Types

The middleware supports:
multiple interface consumers.

Examples:

* chatbots
* APIs
* dashboards
* report generators
* SDKs
* automation systems
* OpenClaw memory systems
* agents
* CLI tools
* semantic search systems

All interfaces consume:
the same middleware infrastructure.

---

# Interface Lifecycle

```txt
External Request
↓
Middleware Interface Contract
↓
Input Processing
↓
Orchestration
↓
Retrieval
↓
Context Assembly
↓
Compression
↓
Generation (optional)
↓
Middleware Response
↓
Interface Rendering
```

---

# Canonical Middleware Request

```ts
interface MiddlewareRequest {
  request_id: string

  client_id: string

  interface_type:
    | "chatbot"
    | "api"
    | "dashboard"
    | "sdk"
    | "agent"
    | "report"
    | "search"
    | "automation"

  request_type:
    | "retrieve"
    | "generate"
    | "search"
    | "analyze"
    | "compress"
    | "summarize"

  input: string

  constraints?: {
    token_budget?: number

    latency_target_ms?: number

    compression_level?: string

    generation_enabled?: boolean
  }

  governance?: {
    access_scope?:
      | "public"
      | "private"
      | "internal"

    role?: string
  }

  metadata?: {
    session_id?: string

    workflow?: string
  }
}
```

---

# Canonical Middleware Response

```ts
interface MiddlewareResponse {
  response_id: string

  request_id: string

  processed_input?: ProcessedInput

  retrieval_result?: RetrievalResult

  context_summary?: string

  generated_output?: string

  confidence?: number

  analytics?: {
    token_usage?: number

    retrieval_time_ms?: number

    compression_ratio?: number

    generation_time_ms?: number
  }

  governance?: {
    filtered_memories?: number

    restricted_results_removed?: boolean
  }

  timestamps: {
    created_at: string
  }
}
```

---

# Middleware Ownership

The middleware owns:

* retrieval logic
* orchestration
* reranking
* compression
* governance
* token management
* memory relationships
* retrieval analytics

Interfaces must not:
reimplement middleware intelligence logic.

The middleware is the single source of semantic intelligence behavior.

---

# Stateless Interface Philosophy

Interfaces should remain:
lightweight and mostly stateless.

Long-term memory remains:
inside middleware systems.

Interfaces are:
interaction layers,
not memory engines.

---

# SDK Philosophy

The middleware supports:
SDK consumption.

External developers may consume:

* retrieval APIs
* memory APIs
* orchestration APIs
* context APIs
* compression APIs

The middleware supports:
portable semantic infrastructure.

---

# OpenClaw / External Memory Systems

External memory systems may:
ingest into middleware memory infrastructure.

The middleware acts as:
a universal semantic memory layer.

External systems may use:

* ingestion pipelines
* retrieval systems
* reranking systems
* orchestration systems
* compression systems

without rebuilding semantic infrastructure.

---

# API Philosophy

The middleware supports:
API-first architecture.

All middleware systems should remain:
externally consumable.

Examples:

* retrieval API
* memory API
* orchestration API
* analytics API
* ingestion API

The middleware is designed for:
modular infrastructure consumption.

---

# Interface Isolation

Interfaces remain isolated from:
internal middleware implementation details.

Interfaces consume:
contracts,
not internal systems directly.

This improves:

* modularity
* portability
* scalability
* maintainability

---

# Governance Enforcement

Governance enforcement occurs:
inside middleware systems.

Interfaces must not:
bypass middleware governance.

Security remains:
centralized infrastructure logic.

---

# Context Ownership

Interfaces do not build:
their own context windows.

The middleware owns:
context assembly,
compression,
and token optimization.

This guarantees:
consistent retrieval behavior.

---

# Retrieval Ownership

Interfaces do not directly:
query vector systems.

Interfaces request:
middleware retrieval services.

This guarantees:

* observability
* governance
* reranking consistency
* orchestration consistency

The middleware owns:
retrieval intelligence.

---

# Compression Ownership

Interfaces do not perform:
manual prompt compression.

The middleware owns:
semantic compression infrastructure.

This guarantees:
consistent token optimization.

---

# Observability

Middleware requests and responses are:
traceable and analytics-aware.

The middleware tracks:

* retrieval performance
* token usage
* compression effectiveness
* orchestration behavior
* interface usage

Observability is infrastructure-level.

---

# Future Interface Expansion

The middleware architecture supports:
future interfaces without architectural redesign.

Examples:

* robotics systems
* local semantic operating systems
* autonomous agents
* browser copilots
* semantic operating environments

The middleware remains:
interface-agnostic.

---

# Final Principle

Interfaces consume semantic infrastructure.

The middleware owns:
memory,
retrieval,
governance,
compression,
and orchestration.

The architecture prioritizes:
portable,
modular,
provider-agnostic semantic infrastructure.
