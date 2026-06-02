# Tenant Isolation Specification

## Overview

Clients remain:
logically isolated.

Every major memory object contains:

```sql id="ti1"
client_id
```

All retrieval operations filter:
client boundaries FIRST.

---

# Isolation Philosophy

Cross-client memory leakage
is prohibited.

Cross-client learning may occur ONLY through:

* aggregated statistics
* anonymized analytics
* non-semantic reinforcement

Raw memory remains isolated.

---

# Retrieval Isolation

Retrieval queries MUST include:

```sql id="ti2"
WHERE client_id = $1
```

before:

* vector search
* reranking
* traversal
* context assembly

Isolation is deterministic.

---

# Governance

Tenant isolation survives:

* retrieval
* compression
* archival
* graph traversal
* analytics

Isolation is infrastructure-level.
