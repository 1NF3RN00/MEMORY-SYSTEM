# Context Assembly Lifecycle Specification

## Overview

The context engine is responsible for constructing the smallest possible high-quality context window for downstream intelligence systems.

The context engine does not simply forward retrieval results into language models.

The purpose of context assembly is to:

* maximize relevance density
* minimize token usage
* preserve semantic meaning
* preserve critical relationships
* reduce retrieval noise
* improve response quality

The middleware prioritizes:
precision context over large context.

---

# Core Philosophy

More context is not inherently better.

Excessive context:

* increases token costs
* increases hallucination risk
* reduces relevance density
* weakens retrieval precision
* slows generation
* introduces semantic noise

The context engine exists to:
construct highly compressed, highly relevant semantic working memory.

---

# Context Assembly Lifecycle

```txt id="sjc23u"
Retrieved Memories
↓
Permission Filtering
↓
Deduplication
↓
Relationship Expansion
↓
Semantic Compression
↓
Summary Prioritization
↓
Context Ordering
↓
Token Budget Enforcement
↓
Final Context Window
```

---

# Stage 1: Permission Filtering

The context engine only processes authorized memories.

Security filtering occurs before:

* ranking
* compression
* expansion
* generation

Unauthorized memories must never enter the context pipeline.

Governance rules are enforced deterministically.

---

# Stage 2: Deduplication

The middleware removes semantically redundant memories.

Deduplication includes:

* duplicate retrievals
* semantic overlap
* repeated summaries
* adjacent redundancy

The engine attempts to preserve:

* source diversity
* semantic uniqueness
* critical details

while minimizing:

* repetition
* token waste
* ranking pollution

---

# Stage 3: Relationship Expansion

The context engine may expand:

* adjacent memories
* parent memories
* child memories
* semantically related memories

Expansion is:

* relevance-aware
* token-aware
* threshold-controlled

Relationship expansion is not unrestricted.

The engine prioritizes:
controlled contextual coherence.

---

# Stage 4: Semantic Compression

Compression is a core middleware capability.

The context engine performs:

* semantic reduction
* redundancy removal
* overlap merging
* detail prioritization

Compression preserves:

* meaning
* source attribution
* relationship integrity
* retrieval confidence

The middleware does not preserve raw text unnecessarily.

---

# Compression Philosophy

The purpose of compression is:
not summarization alone.

The purpose is:
maximum semantic density per token.

Compression attempts to:
retain critical information while minimizing token footprint.

---

# Stage 5: Summary Prioritization

The middleware prioritizes:
summary-first context construction.

Preferred order:

1. semantic summaries
2. compressed memory fragments
3. expanded raw memories

Raw memory expansion occurs only when:

* detail is necessary
* confidence is low
* ambiguity exists
* retrieval quality requires expansion

Summary-first retrieval is a core token optimization strategy.

---

# Stage 6: Context Ordering

The context builder orders memories strategically.

Ordering considers:

* retrieval confidence
* source authority
* semantic importance
* relationship structure
* temporal relevance

Highly relevant memories appear earlier in context windows.

Critical source material is prioritized.

---

# Stage 7: Token Budget Enforcement

The context engine is token-budget aware.

Every retrieval pipeline operates under:

* hard token ceilings
* configurable budgets
* compression thresholds

Token budgets may vary by:

* interface
* model
* workflow
* retrieval strategy

Example:

```json id="p7h4w8"
{
  "chatbot": 4000,
  "report_generation": 12000,
  "lightweight_agent": 2000
}
```

The middleware aggressively minimizes token usage whenever possible.

---

# Context Window Construction

The final context window contains:

* compressed semantic memories
* source attribution
* retrieval metadata
* confidence indicators
* relationship references

The context builder does not expose raw retrieval structures directly to models.

The context engine constructs:
a semantic working memory layer.

---

# Semantic Merging

The middleware may merge overlapping memories.

Example:
multiple pricing memories may become:
a unified pricing context block.

Merging attempts to:

* preserve detail
* remove repetition
* maintain attribution

Merged contexts remain traceable to original memories.

---

# Retrieval Confidence

The context engine tracks confidence levels.

Low-confidence retrieval may trigger:

* retrieval retries
* broader retrieval
* additional expansion
* clarification requests

Confidence-aware context construction is deterministic.

---

# Context Compression Levels

The middleware supports multiple compression levels.

Examples:

* raw
* light compression
* moderate compression
* aggressive compression

Compression level is configurable by:

* workflow
* interface
* orchestration strategy

---

# Source Attribution

The middleware preserves source attribution throughout context assembly.

Attribution includes:

* memory IDs
* source URLs
* source types
* retrieval origins

Attribution supports:

* traceability
* auditing
* debugging
* explainability

---

# Context Is Not Memory

The middleware distinguishes between:

* long-term memory
* retrieval candidates
* active context

Context is temporary semantic working memory.

The purpose of the context engine is:
to transform long-term memory into actionable working memory.

---

# Precision-First Context

The middleware prioritizes:
smaller high-quality contexts over broad noisy contexts.

The context engine aggressively avoids:

* unnecessary expansion
* irrelevant detail
* transcript dumping
* raw memory flooding

The middleware values:
semantic density over semantic volume.

---

# Final Principle

The context engine is responsible for converting retrieved memory into usable intelligence context.

The middleware does not maximize context size.

The middleware maximizes:
relevance density,
semantic clarity,
and token efficiency.
