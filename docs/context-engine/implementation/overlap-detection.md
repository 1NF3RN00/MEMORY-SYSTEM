# Overlap Detection Specification

## Overview

The middleware detects:
semantic overlap between memories.

Overlap detection supports:

* compression
* deduplication
* semantic merging
* context optimization

Overlap detection improves:
token efficiency.

---

# Core Philosophy

Retrieved memories frequently contain:
duplicate semantic meaning.

The middleware removes:
semantic redundancy before generation.

The middleware prioritizes:
unique semantic contribution.

---

# Overlap Detection Signals

Overlap may consider:

* embedding similarity
* phrase overlap
* metadata similarity
* adjacency relationships
* summary similarity

Overlap scoring is:
deterministic and observable.

---

# Overlap Thresholds

Example:

```json id="od1"
{
  "merge_threshold": 0.84,
  "deduplication_threshold": 0.92
}
```

Thresholds remain:
configurable and token-aware.

---

# Overlap Philosophy

The middleware values:
semantic uniqueness,
not repeated retrieval accumulation.
