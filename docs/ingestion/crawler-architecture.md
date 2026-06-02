# Crawler Architecture Specification

## Overview

The middleware supports:
modular semantic ingestion crawling.

The crawler discovers:
semantic source material for ingestion.

Examples:

* websites
* APIs
* documentation
* knowledge bases
* CRM exports
* transcripts
* files

The crawler is:
source acquisition infrastructure.

---

# Core Philosophy

The crawler exists to:
collect semantic source material,
not blindly archive the internet.

The middleware prioritizes:
high-quality semantic ingestion sources.

Crawling remains:
controlled,
observable,
and configurable.

---

# Crawler Responsibilities

The crawler performs:

* URL discovery
* sitemap traversal
* content extraction
* duplicate prevention
* crawl scheduling
* version detection preparation

The crawler does not:
perform retrieval logic.

---

# Crawl Pipeline

```txt id="ca1"
Source Registration
↓
Discovery
↓
Content Fetching
↓
Extraction
↓
Normalization
↓
Queue for Semantic Processing
```

---

# Crawl Controls

Supported controls:

* crawl depth
* domain restrictions
* content filters
* recrawl frequency
* exclusion patterns

The middleware prevents:
unbounded crawl expansion.

---

# Crawl Philosophy

The crawler prioritizes:
high-signal semantic source acquisition.

The middleware values:
retrieval quality over crawl quantity.
