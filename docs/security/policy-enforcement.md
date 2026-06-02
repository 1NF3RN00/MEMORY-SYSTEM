# Policy Enforcement Specification

## Overview

The middleware supports:
deterministic policy enforcement.

Policies control:

* retrieval behavior
* retention behavior
* traversal behavior
* archival behavior
* orchestration constraints

Policies remain:
configuration-driven and enforceable.

---

# Core Philosophy

Policies are:
middleware execution constraints.

Policies exist to:
control semantic infrastructure behavior.

---

# Example Policies

```json id="pe1"
{
  "restricted_memories": {
    "allow_traversal": false
  },

  "archival": {
    "max_retention_days": 365
  }
}
```

---

# Enforcement Philosophy

Policies must remain:
deterministic,
traceable,
and infrastructure-level.
