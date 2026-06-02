# ContextAssembly Specification

## Overview

ContextAssembly represents:
constructed semantic working memory.

ContextAssembly contains:

* merged memories
* summaries
* compression metadata
* ordering
* token accounting

ContextAssembly is:
generation-ready semantic context.

---

# Canonical Structure

```ts id="ca1"
interface ContextAssembly {
  assembly_id: string;

  memories: MemoryObject[];

  merged_context: string;

  compression_level: string;

  token_usage: {
    estimated_tokens: number;
  };

  metadata: {
    overlap_reduction_applied: boolean;
    summaries_used: boolean;
  };
}
```

---

# Context Philosophy

ContextAssembly represents:
high-density semantic working memory infrastructure.
