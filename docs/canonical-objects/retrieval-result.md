# RetrievalResult Specification

## Overview

RetrievalResult represents:
structured semantic retrieval output.

RetrievalResults contain:

* retrieved memories
* confidence scoring
* traversal metadata
* reranking data
* compression recommendations

RetrievalResult is:
core orchestration infrastructure.

---

# Canonical Structure

```ts id="rr1"
interface RetrievalResult {
  retrieval_id: string;

  query: string;

  memories: MemoryObject[];

  confidence_score: number;

  retrieval_metadata: {
    retrieval_strategy: string;
    reranking_applied: boolean;
    traversal_applied: boolean;
  };

  analytics?: {
    latency_ms?: number;
    token_estimate?: number;
  };
}
```

---

# Retrieval Philosophy

RetrievalResults expose:
structured semantic retrieval intelligence,
not raw vector outputs.
