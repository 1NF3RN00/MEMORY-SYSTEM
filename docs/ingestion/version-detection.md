# Version Detection Specification

## Overview

The ingestion engine supports:
version-aware semantic ingestion.

Version detection identifies:
content evolution over time.

Examples:

* updated pricing pages
* revised workflows
* changed policies
* edited documentation

The middleware supports:
memory evolution tracking.

---

# Core Philosophy

Semantic memory evolves.

The middleware avoids:
blind duplicate ingestion.

Version detection preserves:

* historical lineage
* retrieval continuity
* semantic evolution

---

# Version Detection Signals

Versioning may consider:

* content hashing
* semantic similarity
* metadata changes
* structural changes
* source timestamps

Version detection remains:
deterministic and observable.

---

# Version Lifecycle

```txt id="vd1"
Recrawl
↓
Hash Comparison
↓
Semantic Comparison
↓
Version Decision
↓
Update / Archive / Ignore
```

---

# Version Philosophy

The middleware values:
traceable semantic evolution.

Memory lineage remains:
preserved and retrievable.
