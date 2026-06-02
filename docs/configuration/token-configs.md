# Token Configuration Specification

## Overview

Token management is:
configuration-driven.

Token configs control:

* retrieval budgets
* compression limits
* generation limits
* retry ceilings
* orchestration budgets

The middleware treats:
token economics as infrastructure quality.

---

# Example Token Config

```json id="tc1"
{
  "chatbot": {
    "max_context_tokens": 4000,
    "max_generation_tokens": 1200
  },

  "report_generation": {
    "max_context_tokens": 12000
  }
}
```

---

# Token Philosophy

Different workflows require:
different semantic density strategies.

Token configs support:
deterministic token optimization.
