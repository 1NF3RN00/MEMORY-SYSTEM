# Retrieval Configuration Specification

## Overview

Retrieval behavior is:
configuration-driven.

Retrieval configs control:

* scoring weights
* traversal depth
* reranking thresholds
* retries
* metadata weighting
* source authority weighting

Retrieval remains:
deterministic and tunable.

---

# Example Retrieval Config

```json id="rc1"
{
  "retrieval": {
    "semantic_weight": 0.45,
    "keyword_weight": 0.15,
    "metadata_weight": 0.15,
    "relationship_weight": 0.15,
    "temporal_weight": 0.10,

    "minimum_final_score": 0.78,

    "max_relationship_depth": 2,

    "max_retrieval_results": 8
  }
}
```

---

# Retrieval Philosophy

Different workflows require:
different retrieval strategies.

Retrieval configs support:
precision-first orchestration.
