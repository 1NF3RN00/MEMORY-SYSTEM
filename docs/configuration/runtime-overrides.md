# Runtime Override Specification

## Overview

The middleware supports:
runtime configuration overrides.

Runtime overrides allow:
temporary orchestration adjustment.

Overrides may affect:

* retrieval behavior
* compression levels
* traversal depth
* token budgets
* retries

Runtime overrides remain:
governed and observable.

---

# Example Runtime Override

```json id="ro1"
{
  "runtime_override": {
    "compression_level": "aggressive",
    "max_relationship_depth": 1
  }
}
```

---

# Override Philosophy

Overrides support:
controlled orchestration flexibility.

Overrides must not:
break governance boundaries.

The middleware prioritizes:
deterministic override behavior.
