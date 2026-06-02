# Retention Policy Specification

## Overview

The middleware supports:
configurable semantic memory retention policies.

Retention policies govern:
how long semantic memories remain:

* active
* retrievable
* archived
* deletable

Retention policies are:
infrastructure governance systems.

---

# Core Philosophy

Not all semantic memory should persist forever.

Retention should balance:

* retrieval value
* compliance
* operational cost
* governance requirements

Retention remains:
configurable and deterministic.

---

# Example Policies

```json id="rp1"
{
  "retention": {
    "active_days": 365,
    "archive_after_days": 730,
    "delete_after_days": 1825
  }
}
```

---

# Retention Signals

Retention decisions may consider:

* retrieval frequency
* freshness
* workflow importance
* governance classification
* compliance requirements

Retention systems remain:
observable and reversible.

---

# Retention Philosophy

Retention policies protect:
long-term semantic infrastructure quality.
