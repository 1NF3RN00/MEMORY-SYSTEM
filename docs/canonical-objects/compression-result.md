# CompressionResult Specification

## Overview

CompressionResult represents:
semantic compression outcomes.

CompressionResults track:

* semantic retention
* token reduction
* fidelity level
* overlap removal

CompressionResults are:
observable infrastructure artifacts.

---

# Canonical Structure

```ts id="cr1"
interface CompressionResult {
  compression_id: string;

  original_token_count: number;

  compressed_token_count: number;

  compression_ratio: number;

  fidelity_level: string;

  semantic_retention_score?: number;

  compressed_output: string;
}
```

---

# Compression Philosophy

CompressionResults expose:
semantic density optimization quality.
