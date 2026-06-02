# MemoryObject Specification

## Overview

MemoryObject is:
the canonical semantic memory unit
of the middleware.

All semantic retrieval infrastructure operates on:
MemoryObjects.

MemoryObjects contain:

* semantic content
* embeddings
* metadata
* relationships
* summaries
* analytics
* lifecycle state

MemoryObject is:
core middleware infrastructure.

---

# Core Philosophy

MemoryObjects are:
semantic infrastructure entities,
not raw text blobs.

MemoryObjects preserve:

* semantic structure
* relationships
* lineage
* governance
* analytics

---

# Canonical Structure

```ts id="mo1"
interface MemoryObject {
  id: string;

  client_id: string;

  content: string;

  summary?: string;

  embeddings: {
    raw?: number[];
    summary?: number[];
    keyword?: number[];
  };

  metadata: {
    source_url?: string;
    content_type?: string;
    created_at: string;
    updated_at?: string;
    importance_score?: number;
    freshness_score?: number;
  };

  relationships: string[];

  analytics: {
    retrieval_count?: number;
    success_rate?: number;
  };

  lifecycle: {
    archived: boolean;
    stale: boolean;
    decay_score?: number;
  };
}
```

---

# Memory Philosophy

MemoryObjects are:
living semantic infrastructure entities.

The middleware prioritizes:
high-quality structured semantic memory.
