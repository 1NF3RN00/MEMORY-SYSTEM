# Retrieval Lifecycle Specification

## Overview

The retrieval engine is responsible for locating the smallest possible set of highly relevant memory objects required to satisfy a request.

The middleware prioritizes:

* precision-first retrieval
* token efficiency
* semantic relevance
* contextual relationships
* deterministic orchestration

The retrieval system is hybrid by design.

Retrieval combines:

* semantic similarity
* keyword matching
* metadata filtering
* relationship traversal
* temporal scoring
* source weighting
* retrieval analytics

The retrieval engine is deterministic by default.

---

# Core Retrieval Philosophy

The purpose of retrieval is not to maximize recall.

The purpose is to:
construct the highest possible relevance density using the fewest possible tokens.

The middleware prioritizes:

* smaller high-quality contexts
* aggressive filtering
* layered retrieval
* controlled expansion

Broad retrieval occurs only when precision retrieval fails.

---

# Retrieval Lifecycle

```txt id="9r08yo"
INPUT
↓
Input Processing
↓
Intent Classification
↓
Retrieval Strategy Selection
↓
Summary Retrieval
↓
Hybrid Search
↓
Metadata Filtering
↓
Relationship Expansion
↓
Reranking
↓
Compression
↓
Context Assembly
↓
Final Context
```

---

# Stage 1: Input Processing

The input processor normalizes raw input into structured retrieval signals.

The processor extracts:

* keywords
* phrases
* entities
* intent signals
* semantic embeddings
* urgency
* retrieval hints

The output is a ProcessedInput object.

The retrieval engine never consumes raw user input directly.

---

# Stage 2: Intent Classification

Intent classification determines:

* retrieval strategy
* weighting rules
* expansion behavior
* compression behavior
* orchestration routing

Examples:

* pricing query
* troubleshooting query
* policy query
* informational query
* booking intent
* lead intent

Intent classification is deterministic-first.

---

# Stage 3: Retrieval Strategy Selection

The orchestration engine selects a retrieval strategy.

Retrieval strategies are config-driven.

Example:

```json id="0xzcnz"
{
  "pricing_query": {
    "summary_weight": 0.8,
    "metadata_boost": "pricing",
    "relationship_expansion": true
  }
}
```

Strategies determine:

* search depth
* metadata weighting
* relationship expansion
* retry behavior
* compression thresholds

---

# Stage 4: Summary Retrieval

The middleware performs summary-first retrieval.

The engine first retrieves:

* short summaries
* compressed semantic representations
* retrieval summaries

This minimizes:

* retrieval noise
* token usage
* ranking complexity

Raw memory expansion occurs only after reranking.

---

# Stage 5: Hybrid Retrieval

The retrieval engine combines multiple scoring systems.

Hybrid retrieval includes:

* semantic similarity
* keyword relevance
* phrase matching
* metadata filtering
* temporal scoring
* source weighting
* interaction analytics

Embedding similarity alone is insufficient.

---

# Hybrid Retrieval Formula

Retrieval scoring is weighted.

Example:

```txt id="wm9cdg"
FinalScore =
SemanticSimilarity
+ KeywordScore
+ MetadataScore
+ RelationshipScore
+ TemporalScore
+ SourceWeight
+ InteractionWeight
```

Scoring weights are configurable.

The middleware supports future ML reranking systems.

---

# Stage 6: Metadata Filtering

Metadata filtering occurs before final ranking.

Examples:

* visibility filtering
* source filtering
* sensitivity filtering
* content-type filtering
* access-level filtering

Unauthorized memories must never enter ranking pipelines.

---

# Stage 7: Relationship Expansion

The middleware supports graph-based memory expansion.

Relationship traversal includes:

* adjacent memories
* parent memories
* child memories
* related semantic memories

Expansion is controlled and token-aware.

Relationship traversal increases retrieval score.

Expansion must never create uncontrolled context growth.

---

# Stage 8: Reranking

Reranking prioritizes:

* precision
* relevance density
* contextual coherence
* source authority

Reranking considers:

* semantic score
* metadata score
* retrieval history
* interaction success
* relationship proximity
* temporal freshness

The middleware supports:

* weighted reranking
* future ML rerankers
* ensemble reranking

---

# Stage 9: Compression

Compression occurs before final context assembly.

Compression includes:

* semantic deduplication
* overlap merging
* summary prioritization
* redundancy removal

The middleware attempts to preserve:

* semantic meaning
* critical relationships
* source attribution

while minimizing:

* token volume
* repetition
* retrieval noise

---

# Stage 10: Context Assembly

The context builder constructs the final context window.

The context builder prioritizes:

* smallest viable context
* highest relevance density
* source clarity
* relationship preservation

Context assembly is token-budget aware.

The context builder does not dump raw retrieval output directly into models.

---

# Retrieval Retry System

The middleware supports deterministic ensemble retries.

Retries may adjust:

* retrieval thresholds
* metadata weights
* semantic breadth
* keyword weighting
* relationship expansion

Retries occur only when:

* confidence is low
* relevance fails
* retrieval ambiguity is high

Retries are tracked analytically.

---

# Source Weighting

Sources are weighted differently.

Example:

* official pricing pages
* policy documents
* internal documentation

may receive stronger weighting than:

* blogs
* low-priority pages
* stale content

Source weighting is configurable.

---

# Temporal Retrieval

Temporal scoring affects ranking.

Examples:

* recently updated memories boosted
* stale temporary memories decayed
* active conversations boosted

Temporal weighting is configurable.

---

# Precision-First Retrieval

The middleware prioritizes:
few highly relevant memories over broad noisy retrieval.

Fallback expansion occurs only when:

* confidence is insufficient
* retrieval quality is low
* ambiguity remains unresolved

Precision-first retrieval is a core architectural principle.

---

# Retrieval Analytics

The retrieval engine tracks:

* retrieval counts
* retrieval success
* reranking performance
* retry frequency
* failure patterns

Analytics support:

* retrieval optimization
* debugging
* orchestration tuning
* ranking improvements

---

# Final Principle

Retrieval is the core intelligence layer of the middleware.

The quality of memory retrieval determines the quality of downstream intelligence systems.

The middleware prioritizes:

* precision
* modularity
* governance
* token efficiency
* deterministic retrieval
  over raw context accumulation.
