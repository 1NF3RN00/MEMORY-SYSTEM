# Workflow API Specification

## Overview

The workflow API exposes:
deterministic orchestration infrastructure.

Workflow APIs support:

* workflow execution
* retries
* escalation
* orchestration state
* workflow analytics

Workflows remain:
deterministic and governed.

---

# Example Endpoint

```http id="wa1"
POST /v1/workflows/execute
```

---

# Example Request

```json id="wa2"
{
  "workflow": "pricing",

  "query": "how much does roof replacement cost"
}
```

---

# Workflow Philosophy

The workflow API exposes:
semantic execution infrastructure.

The middleware prioritizes:
deterministic orchestration behavior.
