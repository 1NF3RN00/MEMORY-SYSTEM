# Hybrid Retrieval Scoring Specification

## Overview

The middleware uses:
multi-factor hybrid retrieval scoring.

The middleware does not rely solely on:
embedding similarity.

Final retrieval quality depends on:

* semantic similarity
* keyword overlap
* metadata alignment
* relationship proximity
* temporal relevance
* interaction reinforcement
* source authority

The retrieval engine is:
precision-first.

---

# Core Philosophy

Embedding similarity alone is insufficient for:
high-quality semantic retrieval.

The middleware combines:
multiple retrieval signals
into:
weighted semantic ranking.

Retrieval quality is determined through:
semantic convergence,
not vector similarity alone.

---

# Canonical Retrieval Formula

```txt id="hrs1"
FinalScore =
(
  SemanticScore * SemanticWeight
)
+
(
  KeywordScore * KeywordWeight
)
+
(
  MetadataScore * MetadataWeight
)
+
(
  RelationshipScore * RelationshipWeight
)
+
(
  TemporalScore * TemporalWeight
)
+
(
  InteractionScore * InteractionWeight
)
+
(
  SourceAuthority * SourceWeight
)
```

---

# Semantic Score

Semantic score is derived from:
vector similarity.

Preferred metric:
cosine similarity.

Semantic retrieval supports:

* raw embeddings
* summary embeddings
* keyword embeddings

Summary-first retrieval is preferred.

---

# Keyword Score

Keyword scoring supports:

* lexical reinforcement
* exact terminology
* phrase precision
* business terminology

Keyword scoring improves:
retrieval specificity.

Keyword scoring is deterministic.

---

# Metadata Score

Metadata scoring includes:

* source type
* content type
* tags
* headings
* retrieval priority
* governance alignment

Metadata improves:
retrieval precision and orchestration alignment.

---

# Relationship Score

Relationship scoring includes:

* adjacency proximity
* parent-child hierarchy
* semantic graph proximity
* traversal confidence

Relationship-aware scoring improves:
semantic continuity.

---

# Temporal Score

Temporal scoring includes:

* recency
* activity freshness
* recent reinforcement
* stale memory decay

Recent high-quality memories receive:
retrieval boosts.

Stale low-value memories decay over time.

---

# Interaction Score

Interaction scoring includes:

* successful retrieval history
* answer completion success
* clarification frequency
* abandonment rate

High-performing memories gain:
reinforcement weighting.

---

# Source Authority

Source authority prioritizes:
high-trust memory sources.

Examples:

* official documentation
* pricing pages
* policy pages
* validated internal workflows

Low-authority sources receive:
lower weighting.

---

# Weighted Retrieval Philosophy

The middleware supports:
configurable retrieval weighting.

Different workflows may prioritize:
different retrieval signals.

Example:

```json id="hrs2"
{
  "pricing_query": {
    "metadata_weight": 1.5,
    "source_weight": 2.0
  }
}
```

Retrieval remains:
configurable and observable.

---

# Summary-First Retrieval

Preferred retrieval order:

```txt id="hrs3"
summary embeddings
↓
reranking
↓
raw expansion
```

This dramatically improves:

* token efficiency
* retrieval speed
* semantic density

---

# Final Principle

Hybrid retrieval combines:
multiple semantic intelligence signals.

The middleware prioritizes:
precision,
observability,
and semantic convergence
over isolated vector similarity.
