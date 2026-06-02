# Ingestion API Specification

## Overview

The ingestion API exposes:
semantic memory ingestion infrastructure.

The ingestion API supports:

* website ingestion
* file ingestion
* transcript ingestion
* API ingestion
* structured record ingestion

The ingestion API transforms:
external information
into:
semantic memory infrastructure.

---

# Example Endpoints

```http id="ia1"
POST /v1/ingestion/url
POST /v1/ingestion/file
POST /v1/ingestion/transcript
```

---

# Example Request

```json id="ia2"
{
  "client_id": "client_123",

  "source_url": "https://example.com"
}
```

---

# Ingestion Philosophy

The ingestion API exposes:
semantic memory creation infrastructure.

The middleware prioritizes:
structured ingestion quality.
