# Event Types Specification

## Overview

The middleware standardizes:
canonical infrastructure event types.

Event standardization improves:

* observability
* replayability
* analytics
* debugging
* infrastructure consistency

Events are:
versioned infrastructure contracts.

---

# Event Categories

Examples:

* retrieval.completed
* retrieval.failed
* workflow.started
* workflow.completed
* compression.completed
* graph.relationship.created
* ingestion.completed
* governance.denied

Events remain:
structured and deterministic.

---

# Canonical Event Structure

```ts id="et1"
interface MiddlewareEvent {
  event_id: string;

  event_type: string;

  timestamp: string;

  client_id?: string;

  metadata: Record<string, any>;
}
```

---

# Event Philosophy

Events expose:
observable semantic infrastructure behavior.
