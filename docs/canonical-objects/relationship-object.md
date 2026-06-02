# RelationshipObject Specification

## Overview

RelationshipObject represents:
semantic relationships between memories.

Relationships support:

* traversal
* reranking
* semantic continuity
* graph retrieval

Relationships are:
first-class infrastructure entities.

---

# Canonical Structure

```ts id="ro1"
interface RelationshipObject {
  id: string;

  source_memory_id: string;

  target_memory_id: string;

  relationship_type:
    | "adjacent"
    | "hierarchical"
    | "semantic"
    | "workflow"
    | "temporal";

  weight: number;

  metadata?: {
    created_at: string;
    reinforcement_score?: number;
  };
}
```

---

# Relationship Philosophy

Relationships are:
living semantic infrastructure connections.

Relationship quality directly affects:
retrieval quality.
