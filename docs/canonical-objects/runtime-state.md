# RuntimeState Specification

## Overview

RuntimeState represents:
temporary semantic execution state.

RuntimeState tracks:

* orchestration context
* workflow progress
* retry state
* traversal state
* token state

RuntimeState is:
ephemeral execution infrastructure.

---

# Canonical Structure

```ts id="rs1"
interface RuntimeState {
  runtime_id: string;

  workflow_id: string;

  active_stage: string;

  retry_state?: {
    retry_count: number;
  };

  token_state?: {
    current_usage: number;
  };
}
```

---

# Runtime Philosophy

RuntimeState supports:
controlled deterministic semantic execution infrastructure.
