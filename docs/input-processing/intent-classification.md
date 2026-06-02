# Intent Classification Specification

## Overview

The middleware classifies:
semantic user intent.

Intent classification determines:

* retrieval strategy
* orchestration behavior
* retry handling
* workflow routing
* compression strategy

Intent classification is:
deterministic-first.

---

# Core Philosophy

Intent classification exists to:
optimize retrieval behavior.

The middleware prioritizes:
predictable orchestration.

Intent systems remain:
observable and configurable.

---

# Supported Intent Categories

Examples:

* informational
* pricing
* troubleshooting
* booking
* support
* escalation
* comparison
* lead intent

---

# Deterministic Classification

Intent classification primarily uses:

* keyword signals
* phrase signals
* metadata patterns
* scoring systems

The middleware may later support:
lightweight classifiers.

Core orchestration remains:
deterministic.

---

# Intent Scoring

Example:

```json id="ic1"
{
  "pricing": 0.91,
  "booking": 0.34,
  "support": 0.12
}
```

The highest-confidence intent becomes:
primary orchestration context.
