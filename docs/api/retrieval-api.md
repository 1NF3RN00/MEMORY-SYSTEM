# Retrieval API Specification

## Overview

The retrieval API exposes:
semantic retrieval infrastructure.

The retrieval API supports:

* hybrid retrieval
* graph-aware retrieval
* reranking
* compression-aware retrieval
* orchestration-aware retrieval

Retrieval APIs return:
structured semantic intelligence.

---

# Example Endpoint

```http id="ra1"
POST /v1/retrieval/query
```

---

# Example Request

```json id="ra2"
{
  "client_id": "client_123",

  "query": "roof replacement financing",

  "workflow": "pricing",

  "constraints": {
    "max_tokens": 4000
  }
}
```

---

# Example Response

```json id="ra3"
{
  "retrieval_id": "retrieval_123",

  "confidence": 0.91,

  "memories": [],

  "context_summary": "..."
}
```

---

# Retrieval Philosophy

The retrieval API exposes:
semantic retrieval infrastructure,
not raw vector search.
