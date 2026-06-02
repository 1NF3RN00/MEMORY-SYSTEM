# Middleware Client Specification

## Overview

The middleware client provides:
standardized infrastructure access.

Clients support:

* authentication
* retrieval
* ingestion
* graph querying
* workflow execution
* analytics access

Middleware clients abstract:
API communication complexity.

---

# Example SDK Usage

```ts id="mc1"
const middleware = new MiddlewareClient({
  apiKey: process.env.API_KEY
});

const result = await middleware.retrieve({
  query: "roof replacement financing"
});
```

---

# Client Philosophy

Middleware clients provide:
portable semantic infrastructure access.

The middleware values:
modular infrastructure consumption.
