# Workflow Configuration Specification

## Overview

Workflow behavior is:
configuration-driven.

Workflows control:

* orchestration strategies
* retries
* escalation behavior
* token budgets
* retrieval specialization
* generation behavior

Workflows remain:
deterministic and modular.

---

# Example Workflow Config

```json id="wc1"
{
  "pricing_workflow": {
    "retrieval_strategy": "pricing_boost",

    "compression_level": "light",

    "max_retries": 1,

    "escalation_enabled": true
  }
}
```

---

# Workflow Philosophy

Different semantic tasks require:
different orchestration behavior.

Workflow configs support:
specialized semantic infrastructure execution.
