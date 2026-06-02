# Memory Object V1 Specification

## Overview

The Memory Object is the canonical storage primitive of the semantic middleware system.

All information entering the middleware is normalized into memory objects.

Examples include:

* website content
* PDFs
* conversations
* CRM notes
* logs
* transcripts
* APIs
* internal business data
* structured documents
* external memory systems

The middleware does not fundamentally distinguish between these sources after normalization.

Everything becomes semantic memory.

---

# Design Principles

Memory objects must be:

* modular
* retrievable
* compressible
* governable
* relationship-aware
* provider-agnostic
* version-aware
* token-efficient

The memory object is designed for:

* hybrid retrieval
* graph traversal
* semantic compression
* deterministic orchestration
* long-term scalability

---

# Canonical Memory Object

```ts
interface MemoryObject {
  memory_id: string

  client_id: string

  memory_type:
    | "document"
    | "website"
    | "conversation"
    | "crm_note"
    | "api"
    | "system"
    | "structured"
    | "external"

  content: {
    raw: string

    normalized?: string

    summary_short?: string

    summary_long?: string
  }

  embeddings: {
    raw_embedding?: number[]

    summary_embedding?: number[]

    keyword_embedding?: number[]
  }

  metadata: {
    title?: string

    source_type?: string

    source_url?: string

    source_id?: string

    author?: string

    tags?: string[]

    headings?: string[]

    content_type?: string

    language?: string

    version?: number

    version_hash?: string

    retrieval_priority?: number

    importance_score?: number

    decay_rate?: number

    visibility:
      | "public"
      | "private"

    access_level:
      | "external"
      | "internal"
      | "system"

    sensitivity:
      | "low"
      | "medium"
      | "high"
      | "restricted"

    archived?: boolean
  }

  relationships: {
    parent_memory_id?: string

    child_memory_ids?: string[]

    previous_memory_id?: string

    next_memory_id?: string

    related_memory_ids?: string[]

    bidirectional_links?: boolean
  }

  retrieval: {
    retrieval_count?: number

    successful_retrievals?: number

    failed_retrievals?: number

    average_score?: number

    last_retrieved_at?: string

    keyword_index?: string[]

    phrase_index?: string[]

    temporal_boost?: number

    semantic_weight?: number

    metadata_weight?: number

    relationship_weight?: number
  }

  timestamps: {
    created_at: string

    updated_at: string

    last_accessed_at?: string

    archived_at?: string
  }
}
```

---

# Multi-Embedding Architecture

Memory objects support multiple embeddings immediately.

Supported embeddings include:

* raw content embeddings
* summary embeddings
* keyword embeddings

This architecture enables:

* summary-first retrieval
* semantic compression
* lightweight ranking
* token-efficient retrieval
* layered retrieval strategies

Additional embeddings may be added later.

---

# Relationship Architecture

Memory relationships support graph traversal.

Relationships are not lightweight references only.

The middleware supports:

* parent relationships
* child relationships
* adjacency traversal
* semantic relationships
* bidirectional links

This enables:

* hierarchical retrieval
* adjacent memory expansion
* semantic graph exploration
* contextual relationship scoring

---

# Versioning

Memory objects support version-aware ingestion.

Version metadata includes:

* version number
* version hashes
* update timestamps

Older versions are not immediately deleted.

The middleware may archive previous versions for:

* rollback
* auditing
* historical analysis
* retrieval debugging

---

# Archival Philosophy

Deleted memories are soft archived by default.

Archived memories may be:

* compressed
* zipped
* moved to cold storage

Archived memories remain available for:

* restoration
* auditing
* debugging
* historical retrieval

---

# Importance Decay

Memory objects support retrieval decay over time.

Temporary or low-value memories gradually lose retrieval strength unless reinforced through:

* successful retrievals
* interaction success
* recency
* manual boosts

This prevents retrieval pollution over long-term operation.

---

# Retrieval Analytics

Memory objects track retrieval performance statistics.

Examples include:

* retrieval frequency
* success rates
* average ranking score
* retrieval failures

These analytics support:

* reranking optimization
* retrieval debugging
* quality monitoring
* adaptive retrieval systems

---

# Cross-Client Learning

The middleware may support cross-client statistical learning.

Cross-client learning is:

* statistical
* aggregated
* modular

Client memory remains logically isolated.

Cross-client learning must never violate:

* visibility rules
* access permissions
* private memory boundaries

---

# Time-Aware Retrieval

Memory objects support temporal retrieval boosting.

Examples:

* recent updates boosted
* active conversations boosted
* stale memories decayed

Temporal boosting is configurable through retrieval orchestration.

---

# Summary Generation

Semantic summaries are generated during ingestion.

Supported summaries include:

* short summaries
* long summaries
* retrieval summaries

Summaries are first-class retrieval assets.

The middleware supports summary-first retrieval workflows.

---

# Governance Requirements

All memory objects must contain governance metadata.

Governance metadata includes:

* visibility
* access level
* sensitivity
* ownership

Governance filtering occurs BEFORE ranking and retrieval expansion.

Unauthorized memories must never enter retrieval scoring pipelines.

---

# Final Principle

The Memory Object is the universal semantic storage primitive of the middleware.

All middleware systems operate on memory objects.

Interfaces consume memory objects through retrieval and orchestration layers.

Memory is infrastructure.
