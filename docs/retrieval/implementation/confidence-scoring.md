# Confidence Scoring Specification

## Overview

The middleware continuously evaluates:
retrieval confidence.

Confidence scoring affects:

* retries
* fallback handling
* context expansion
* orchestration behavior

Confidence is:
deterministic and measurable.

---

# Confidence Factors

Confidence may consider:

* semantic agreement
* reranking consistency
* source convergence
* retrieval ambiguity
* retry frequency
* interaction history

---

# Confidence Formula

```txt id="cs1"
Confidence =
(
  AverageRetrievalScore
)
+
(
  SourceAgreement
)
+
(
  SemanticConsistency
)
-
(
  AmbiguityPenalty
)
-
(
  RetryPenalty
)
```

---

# Low Confidence Handling

Low confidence may trigger:

* retrieval retries
* broader retrieval
* clarification requests
* reduced compression
* escalation suggestions

The middleware does not:
fabricate certainty.

---

# Confidence Philosophy

Confidence is:
retrieval quality awareness.

The middleware continuously evaluates:
semantic reliability.
