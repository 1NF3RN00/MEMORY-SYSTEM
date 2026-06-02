# Retrieval Threshold Specification

## Overview

The middleware uses:
deterministic retrieval thresholds.

Thresholds control:

* retrieval expansion
* reranking eligibility
* graph traversal
* retries
* compression depth

Thresholds prevent:
retrieval explosion.

---

# Core Philosophy

The middleware prioritizes:
controlled retrieval precision.

Thresholds prevent:

* noisy retrieval
* uncontrolled traversal
* low-quality expansion

Thresholds are:
configurable and observable.

---

# Threshold Examples

```json id="rt1"
{
  "minimum_semantic_score": 0.72,
  "minimum_final_score": 0.78,
  "maximum_relationship_depth": 2,
  "retry_trigger_threshold": 0.65
}
```

---

# Traversal Thresholds

Graph traversal requires:
minimum traversal confidence.

Low-confidence relationships:
do not expand automatically.

---

# Retry Thresholds

Retries occur only when:
confidence falls below:
configured thresholds.

Retries are:
controlled and deterministic.
