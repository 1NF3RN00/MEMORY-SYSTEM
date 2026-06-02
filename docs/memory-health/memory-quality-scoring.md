# Memory Quality Scoring Specification

## Overview

The middleware evaluates:
individual memory quality.

Memory quality affects:

* retrieval priority
* reranking
* decay
* archival decisions
* compression behavior

Memory quality is:
scored infrastructure behavior.

---

# Core Philosophy

Not all memories provide:
equal semantic value.

The middleware prioritizes:
high-value semantic memory.

---

# Quality Signals

Memory quality may consider:

* retrieval success
* semantic uniqueness
* source authority
* relationship strength
* freshness
* interaction outcomes

Quality scoring remains:
observable and deterministic.

---

# Example Quality Formula

```txt id="mqs1"
MemoryQuality =
(
  RetrievalSuccess
)
+
(
  SemanticUniqueness
)
+
(
  SourceAuthority
)
+
(
  RelationshipStrength
)
-
(
  RedundancyPenalty
)
```

---

# Quality Philosophy

Memory quality scoring improves:
long-term semantic infrastructure quality.
