# Signal Detection Specification

## Overview

The middleware detects:
operational semantic signals.

Signals influence:

* orchestration
* retrieval weighting
* escalation behavior
* lead handling
* retries

Signals are:
weighted and deterministic.

---

# Supported Signals

Examples:

* pricing interest
* urgency
* frustration
* confusion
* escalation risk
* lead intent
* booking intent

Signals are:
behavioral retrieval intelligence.

---

# Signal Weighting

Signals are numerically weighted.

Example:

```json id="sd1"
{
  "urgency": 0.84,
  "pricing_interest": 0.91
}
```

Signals influence:
retrieval and orchestration behavior.

---

# Signal Philosophy

Signals support:
retrieval optimization and orchestration refinement.

Signals do not:
autonomously control middleware behavior.

The middleware remains:
deterministic-first.
