# WorkflowExecution Specification

## Overview

WorkflowExecution represents:
runtime orchestration execution state.

WorkflowExecution tracks:

* workflow stages
* retries
* orchestration decisions
* escalations
* token usage

WorkflowExecution is:
runtime orchestration infrastructure.

---

# Canonical Structure

```ts id="we1"
interface WorkflowExecution {
  workflow_id: string;

  workflow_type: string;

  current_state: string;

  retry_count: number;

  orchestration_metadata: {
    retrieval_strategy?: string;
    compression_strategy?: string;
  };

  analytics?: {
    latency_ms?: number;
    total_tokens?: number;
  };
}
```

---

# Workflow Philosophy

WorkflowExecution exposes:
deterministic orchestration state infrastructure.
