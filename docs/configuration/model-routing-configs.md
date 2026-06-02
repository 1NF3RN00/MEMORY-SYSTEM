# Model Routing Configuration Specification

## Overview

Model selection is:
configuration-driven.

The middleware supports:
provider-agnostic model routing.

Routing configs control:

* provider selection
* fallback routing
* task specialization
* cost optimization

Model routing remains:
modular and portable.

---

# Example Model Routing Config

```json id="mr1"
{
  "embedding": {
    "provider": "openai",
    "model": "text-embedding"
  },

  "summarization": {
    "provider": "anthropic",
    "model": "haiku"
  }
}
```

---

# Routing Philosophy

The middleware treats:
models as interchangeable infrastructure utilities.

Routing configs support:
future-proof semantic infrastructure.
