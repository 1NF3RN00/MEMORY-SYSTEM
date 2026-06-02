# Keyword Extraction Specification

## Overview

The middleware performs:
deterministic keyword extraction.

Keywords support:

* lexical retrieval
* metadata matching
* reranking
* retrieval hints
* signal scoring

Keyword extraction is:
lightweight and inexpensive.

---

# Core Philosophy

Keywords are:
retrieval signals,
not complete semantic understanding.

Keyword extraction improves:
retrieval specificity.

The middleware avoids:
expensive model-based extraction
for lightweight preprocessing tasks.

---

# Extraction Pipeline

```txt id="ke1"
Normalization
↓
Stopword Removal
↓
Token Cleanup
↓
Frequency Analysis
↓
Weighted Ranking
↓
Keyword Selection
```

---

# Keyword Signals

Keyword weighting may consider:

* frequency
* token length
* rarity
* phrase participation
* metadata overlap

Examples:

* roof replacement
* financing
* emergency repair

---

# Lightweight Philosophy

Keyword extraction should remain:
fast,
deterministic,
and inexpensive.

The middleware prioritizes:
minimal preprocessing cost.
