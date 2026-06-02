# Reranking Engine Specification

## Overview

The reranking engine refines:
initial retrieval candidates.

The middleware prioritizes:
precision-first reranking.

The reranker improves:

* relevance density
* contextual coherence
* source quality
* semantic continuity

Reranking is:
deterministic and observable.

---

# Reranking Lifecycle

```txt id="rr1"
Initial Retrieval
↓
Candidate Expansion
↓
Metadata Evaluation
↓
Relationship Evaluation
↓
Confidence Evaluation
↓
Final Reranking
```

---

# Reranking Signals

The reranker considers:

* semantic similarity
* metadata alignment
* relationship strength
* source authority
* retrieval history
* temporal relevance
* interaction success

The middleware prioritizes:
multi-signal reranking.

---

# Candidate Reduction

The reranker aggressively reduces:
low-quality candidates.

Example:

```txt id="rr2"
50 retrieved
↓
15 reranked
↓
6 final memories
```

The middleware values:
high-density retrieval.

---

# Relationship-Aware Reranking

Relationship proximity improves:
reranking quality.

Examples:

* adjacent sections
* parent hierarchy
* semantic linkage

Relationship-aware reranking improves:
contextual coherence.

---

# Reranking Philosophy

Reranking exists to:
maximize semantic quality per token.

The reranker prioritizes:

* semantic coherence
* source quality
* retrieval precision
* token efficiency

The middleware avoids:
broad noisy context windows.
