# PostgreSQL Architecture Specification

## Overview

The middleware uses PostgreSQL as:
the canonical structured memory infrastructure database.

PostgreSQL stores:

* semantic memory metadata
* governance metadata
* graph relationships
* retrieval analytics
* orchestration analytics
* interaction outcomes
* vector references
* lifecycle metadata

The middleware uses:
PostgreSQL + pgvector
as unified semantic infrastructure.

---

# Core Philosophy

The middleware prioritizes:

* deterministic storage
* relational governance
* graph-aware retrieval
* observability
* transactional consistency

The middleware avoids:
fragmented infrastructure complexity when unnecessary.

PostgreSQL acts as:
the semantic control plane.

---

# Storage Layers

The middleware separates:
different storage concerns.

Examples:

| Storage Layer      | Purpose               |
| ------------------ | --------------------- |
| Relational Storage | metadata + governance |
| Vector Storage     | embeddings            |
| Graph Storage      | relationships         |
| Analytics Storage  | telemetry             |
| Archival Storage   | cold memory           |

These remain:
logically separated,
even if physically colocated.

---

# Primary Database Responsibilities

PostgreSQL stores:

* memory metadata
* governance state
* retrieval analytics
* interaction outcomes
* orchestration logs
* relationship edges
* lifecycle state
* source lineage

PostgreSQL does not store:
massive raw document blobs as primary working memory.

---

# Multi-Tenant Philosophy

Clients remain:
logically isolated.

Every major table contains:

```sql id="pga1"
client_id
```

The middleware avoids:
cross-client retrieval contamination.

Cross-client learning remains:
statistical only.

---

# pgvector Integration

The middleware uses:
pgvector for embedding storage.

Supported embedding categories:

* raw embeddings
* summary embeddings
* keyword embeddings

Future embeddings:
remain extensible.

---

# Infrastructure Philosophy

PostgreSQL acts as:
semantic infrastructure,
not merely application storage.

The middleware prioritizes:

* observability
* scalability
* governance
* relationship traversal
* retrieval performance

---

# Future Scalability

The architecture supports:
future scaling strategies.

Examples:

* read replicas
* vector partitioning
* dedicated analytics storage
* distributed graph systems
* cold archival systems

The middleware remains:
modular and evolvable.
