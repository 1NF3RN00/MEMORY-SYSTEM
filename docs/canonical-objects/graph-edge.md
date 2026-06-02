# GraphEdge Specification

## Overview

GraphEdge represents:
runtime graph traversal infrastructure.

GraphEdges support:

* traversal scoring
* graph expansion
* reranking
* semantic continuity

GraphEdges are:
runtime traversal entities.

---

# Canonical Structure

```ts id="ge1"
interface GraphEdge {
  edge_id: string;

  from: string;

  to: string;

  traversal_weight: number;

  edge_type: string;

  governance: {
    traversable: boolean;
  };
}
```

---

# Graph Philosophy

GraphEdges support:
relationship-aware semantic retrieval infrastructure.
