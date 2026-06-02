# Client Configuration Specification

## Overview

Each client supports:
isolated semantic configuration.

Clients may customize:

* retrieval behavior
* workflows
* token budgets
* graph traversal
* lead handling
* model routing

Client configuration enables:
specialized middleware behavior.

---

# Core Philosophy

Clients should share:
middleware infrastructure,
not semantic behavior.

The middleware supports:
tenant-specific semantic tuning.

---

# Example Client Config

```json id="cc1"
{
  "client_id": "client_123",

  "retrieval": {
    "summary_first": true,
    "max_context_tokens": 4000
  },

  "compression": {
    "default_level": "moderate"
  },

  "graph": {
    "max_traversal_depth": 2
  },

  "lead_detection": {
    "enabled": true
  }
}
```

---

# Isolation Philosophy

Client configurations remain:
isolated and governed.

Cross-client configuration contamination
is prohibited.

---

# Client Philosophy

Clients consume:
shared middleware infrastructure
through:
isolated configuration layers.
