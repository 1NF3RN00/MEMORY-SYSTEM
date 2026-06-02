# Embedding Generation Specification

## Overview

The ingestion engine generates:
multiple embeddings per memory object.

Embeddings support:

* semantic retrieval
* reranking
* overlap detection
* semantic clustering

The middleware supports:
multi-embedding retrieval architecture.

---

# Supported Embedding Types

Examples:

* raw embeddings
* summary embeddings
* keyword embeddings

Future embedding types remain:
extensible.

---

# Core Philosophy

Embeddings are:
retrieval signals,
not standalone intelligence systems.

The middleware combines:
embeddings,
metadata,
relationships,
and analytics.

---

# Embedding Pipeline

```txt id="eg1"
Memory Object
↓
Raw Embedding
↓
Summary Embedding
↓
Keyword Embedding
↓
Embedding Validation
↓
Vector Storage
```

---

# Embedding Versioning

Embeddings support:

* provider migration
* model upgrades
* regeneration
* version tracking

Embedding evolution remains:
observable and modular.
