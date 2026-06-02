# Retrieval Result Specification

## Overview

The RetrievalResult object is the canonical retrieval output structure of the middleware.

The retrieval engine does not return:
raw chunks alone.

The middleware returns:
ranked semantic retrieval intelligence.

Retrieval results contain:

* memory references
* ranking information
* confidence metrics
* retrieval analytics
* governance state
* relationship metadata
* compression metadata
* source attribution

The RetrievalResult object acts as the bridge between:

* retrieval
* reranking
* context assembly
* orchestration
* analytics
* observability systems

---

# Core Philosophy

Retrieval is not:
vector lookup.

Retrieval is:
semantic intelligence selection.

The middleware prioritizes:

* observability
* traceability
* ranking explainability
* retrieval analytics
* governance-aware retrieval

Retrieval systems must remain:

* debuggable
* deterministic
* measurable
* configurable

---

# Retrieval Lifecycle Position

```txt id="8z5w8u"
ProcessedInput
↓
Retrieval Strategy
↓
Hybrid Retrieval
↓
Metadata Filtering
↓
Relationship Expansion
↓
Reranking
↓
RetrievalResult
↓
Context Assembly
```

---

# Canonical RetrievalResult

```ts id="jlwm81"
interface RetrievalResult {
  retrieval_id: string

  client_id: string

  processed_input_id?: string

  memories: RetrievedMemory[]

  retrieval_metadata: {
    retrieval_strategy?: string

    retrieval_stage?: string

    retry_count?: number

    confidence_score?: number

    reranker_used?: string

    compression_applied?: boolean

    relationship_expansion_applied?: boolean

    token_estimate?: number
  }

  analytics: {
    retrieval_time_ms?: number

    rerank_time_ms?: number

    memories_scanned?: number

    memories_returned?: number

    retries_triggered?: number
  }

  timestamps: {
    created_at: string
  }
}
```

---

# Canonical RetrievedMemory

```ts id="3jlwm2"
interface RetrievedMemory {
  memory_id: string

  memory_type?: string

  content: {
    raw?: string

    summary?: string

    compressed?: string
  }

  retrieval_scores: {
    final_score?: number

    semantic_score?: number

    keyword_score?: number

    metadata_score?: number

    relationship_score?: number

    temporal_score?: number

    source_weight?: number

    interaction_weight?: number
  }

  retrieval_metadata: {
    retrieval_rank?: number

    retrieval_reason?: string[]

    retrieved_via?: string[]

    expanded_via_relationship?: boolean

    compression_level?: string

    source_type?: string

    source_url?: string
  }

  governance: {
    visibility?: string

    access_level?: string

    sensitivity?: string
  }

  relationships: {
    parent_memory_id?: string

    related_memory_ids?: string[]

    adjacent_memory_ids?: string[]
  }

  analytics: {
    retrieval_count?: number

    success_rate?: number

    historical_confidence?: number
  }
}
```

---

# Retrieval Result Philosophy

The retrieval engine returns:
structured semantic intelligence,
not raw vector output.

Retrieval results are:
traceable,
explainable,
and analytics-aware.

The middleware prioritizes:
retrieval observability.

---

# Ranking Explainability

The middleware tracks:
why memories were retrieved.

Examples:

* semantic similarity
* keyword overlap
* metadata match
* source authority
* relationship traversal
* temporal boosting

Retrieval explainability supports:

* debugging
* reranking optimization
* orchestration tuning
* retrieval analytics

The middleware values:
retrieval transparency.

---

# Multi-Score Retrieval

Retrieval uses:
multi-dimensional scoring.

The middleware does not rely solely on:
embedding similarity.

Examples:

* semantic score
* keyword score
* metadata score
* relationship score
* temporal score
* interaction score

Final retrieval ranking is weighted and configurable.

---

# Confidence Tracking

Retrieval results contain:
confidence metrics.

Confidence scoring may consider:

* reranking agreement
* retrieval consistency
* semantic coherence
* source authority
* ambiguity
* retry history

Low-confidence retrieval may trigger:

* retries
* fallback retrieval
* clarification workflows
* expanded search

Confidence tracking is deterministic.

---

# Relationship-Aware Retrieval

Retrieval results support:
graph-aware memory expansion.

Retrieved memories may include:

* parent memories
* child memories
* adjacent memories
* semantic relationships

Relationship expansion remains:
controlled,
token-aware,
and governed.

---

# Compression Awareness

Retrieved memories may contain:

* summaries
* compressed variants
* semantic reductions

The middleware supports:
summary-first retrieval workflows.

Compression metadata remains traceable.

The context engine determines:
final expansion behavior.

---

# Governance-Aware Retrieval

Retrieved memories contain:
governance metadata.

Governance filtering occurs before:
retrieval results are generated.

Unauthorized memories must never:
appear in RetrievalResult objects.

Governance enforcement is deterministic.

---

# Retry Awareness

Retrieval results track:
retry behavior.

Examples:

* retry count
* retry strategies
* fallback retrieval
* reranking retries

Retry observability supports:

* analytics
* orchestration tuning
* retrieval debugging

The middleware values:
traceable retrieval behavior.

---

# Source Attribution

Retrieved memories preserve:
source attribution.

Examples:

* source URLs
* source types
* memory origins
* retrieval paths

Attribution supports:

* explainability
* auditing
* debugging
* trust evaluation

---

# Historical Analytics

Retrieved memories may contain:
historical retrieval analytics.

Examples:

* historical success rates
* retrieval frequency
* interaction reinforcement
* retrieval confidence history

Analytics support:

* reranking optimization
* retrieval quality monitoring
* adaptive weighting systems

---

# Retrieval Result vs Context

Retrieval results are:
not final context windows.

Retrieval results are:
intermediate semantic retrieval intelligence.

The context engine transforms:
retrieval results
into:
working semantic context.

The middleware distinguishes between:

* retrieval
* context assembly
* generation

These are separate middleware responsibilities.

---

# Observability Philosophy

The middleware prioritizes:
full retrieval observability.

Retrieval systems must remain:

* measurable
* debuggable
* explainable
* deterministic

The middleware avoids:
opaque black-box retrieval systems.

---

# Final Principle

RetrievalResult objects represent:
ranked semantic retrieval intelligence.

The middleware treats retrieval as:
a governed,
observable,
precision-first infrastructure system.
