# Vector Indexing Specification

## Overview

The middleware uses:
pgvector-based embedding infrastructure.

The middleware supports:
multiple embeddings per memory object.

Examples:

* raw embeddings
* summary embeddings
* keyword embeddings

The retrieval engine supports:
hybrid semantic retrieval.

---

# Core Philosophy

Embeddings are:
retrieval signals,
not standalone intelligence.

The middleware combines:

* vectors
* metadata
* graph traversal
* reranking
* governance

Embedding similarity alone is insufficient.

---

# Embedding Storage Strategy

Embeddings are separated into:
dedicated storage rows.

This supports:

* multiple embedding types
* embedding versioning
* provider migration
* future expansion

---

# Canonical Embedding Types

| Type    | Purpose               |
| ------- | --------------------- |
| raw     | detail retrieval      |
| summary | lightweight ranking   |
| keyword | lexical reinforcement |

Future embedding types:
remain extensible.

---

# HNSW Indexing

Preferred strategy:
HNSW indexes.

Example:

```sql id="vi1"
CREATE INDEX memory_embedding_hnsw
ON memory_embeddings
USING hnsw (embedding vector_cosine_ops);
```

---

# Distance Metric

Preferred metric:
cosine similarity.

Reason:
semantic embedding consistency.

---

# Multi-Embedding Retrieval

The middleware supports:
layered embedding retrieval.

Example workflow:

```txt id="vi2"
summary retrieval
↓
reranking
↓
raw embedding expansion
```

This dramatically improves:
token efficiency and retrieval precision.

---

# Client Isolation

Embedding retrieval always filters:

```sql id="vi3"
client_id
```

before retrieval execution.

Cross-client retrieval contamination is prohibited.

---

# Retrieval Partitioning

Future architecture may support:

* client partitioning
* embedding partitioning
* archival vector partitions
* hot/cold vector separation

The middleware remains:
scalable and modular.

---

# Embedding Versioning

Embeddings support:

* provider migration
* model upgrades
* embedding regeneration

Embedding evolution remains:
observable and version-aware.

---

# Retrieval Philosophy

The middleware prioritizes:
precision-first retrieval.

Vector retrieval acts as:
one signal among many.

Final retrieval combines:

* semantic similarity
* metadata
* graph relationships
* analytics
* reranking
* governance
