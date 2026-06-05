# Observation Providers and Workflow Architecture

## Purpose



The system does not store "SEO data", "Facebook data", or "Competitor data".

The system stores normalized observations.

Domains retrieve observations.

Workflows consume domains.

This preserves the middleware's core philosophy:

* retrieval-first
* domain-driven
* workflow-oriented
* deterministic
* explainable
* reusable across industries

---

# Core Philosophy

Observation providers are not business logic.

Observation providers only:

1. Collect
2. Normalize
3. Store
4. Tag

They do not:

* generate recommendations
* perform analysis
* make decisions
* execute workflows
* determine strategy

Their sole purpose is creating high-quality observations that become retrievable memory.

---

# Architectural Flow

```text
Observation Provider
        ↓
Observation
        ↓
Memory Object
        ↓
Metadata
        ↓
Domain Retrieval
        ↓
Workflow Execution
        ↓
Business Output
```

Or:

```text
Scrapers
↓
Observations
↓
Memory
↓
Domains
↓
Workflows
↓
Reports
Recommendations
Actions
```

---

# Observation Model

Every observation is normalized into a canonical structure.

Example:

```json
{
  "businessId": "joe-landscaping",
  "metric": "review_count",
  "value": 85,
  "source": "google_business_profile",
  "timestamp": "2026-06-05T00:00:00Z"
}
```

All providers ultimately generate observations.

Observations become memory objects.

---

# Observation Categories

Observation categories describe information.

They are NOT domains.

They are NOT workflows.

They are raw observations.

---

## Website Observations

Categories:

```text
site_structure
metadata
heading_structure
content
internal_seo
technical_seo
accessibility
```

Examples:

```text
page_count
service_page_count
pages_missing_title
duplicate_titles
average_word_count
internal_link_count
schema_present
accessibility_score
```

---

## PageSpeed Observations

Categories:

```text
performance
core_web_vitals
business_metrics
```

Examples:

```text
mobile_score
desktop_score
largest_contentful_paint
cumulative_layout_shift
speed_index
```

---

## Google Business Profile Observations

Categories:

```text
profile_quality
reputation
engagement
```

Examples:

```text
review_count
average_rating
review_velocity
days_since_last_google_post
```

---

## Facebook Observations

Categories:

```text
presence
activity
engagement
```

Examples:

```text
follower_count
posts_per_month
average_post_reactions
average_post_comments
```

---

## Instagram Observations

Categories:

```text
presence
activity
engagement
```

Examples:

```text
follower_count
posts_per_month
engagement_rate
average_likes
```

---

## TikTok Observations

Categories:

```text
presence
activity
engagement
reach
growth
```

Examples:

```text
average_views
average_likes
engagement_rate
monthly_view_growth
monthly_follower_growth
```

---

## Search Visibility Observations

Categories:

```text
rankings
visibility
```

Examples:

```text
keyword_rank
average_rank
top3_keywords
top10_keywords
```

---

## Competitor Observations

Categories:

```text
website
reputation
visibility
social
```

Examples:

```text
competitor_review_count
competitor_rating
competitor_speed_score
competitor_page_count
competitor_rankings
```

---

# Observation Metadata

All observations should be stored as memory objects with enriched metadata.

Example:

```json
{
  "sourceUrl": "...",
  "sourceLabel": "...",

  "businessId": "...",

  "platform": "facebook",

  "observationType": "engagement",

  "observationCategory": "social",

  "competitorId": null,

  "domainTags": [
    "social",
    "engagement"
  ],

  "workflowTags": [
    "marketing-review"
  ],

  "collectedAt": "...",

  "tags": []
}
```

Metadata exists to improve retrieval quality.

Metadata is not business logic.

---

# Domains

Domains are retrieval boundaries.

Domains are not storage systems.

Domains are not object containers.

Domains define:

* what information is relevant
* how information is retrieved
* what facts apply
* what instructions apply

Domains retrieve observations through metadata filtering and retrieval rules.

---

## Examples

### SEO Domain

Retrieves:

* website observations
* pagespeed observations
* search visibility observations
* SEO facts
* SEO instructions

Purpose:

Generate SEO-specific context.

---

### Competitor Domain

Retrieves:

* competitor observations
* competitor crawl data
* competitor rankings
* competitor social activity
* competitor facts

Purpose:

Generate competitor intelligence context.

---

### Reputation Domain

Retrieves:

* review observations
* rating observations
* review velocity observations

Purpose:

Generate reputation intelligence.

---

### Brand Domain

Retrieves:

* brand facts
* messaging facts
* communication standards
* visual identity guidance

Purpose:

Generate brand-consistent outputs.

---

### Strategy Domain

Retrieves:

* strategic facts
* strategic instructions
* strategic objectives
* related supporting context

Purpose:

Maintain alignment with business goals.

---

# Domain Packages

Packages bundle reusable business capabilities.

A package may contain:

* domains
* facts
* instructions
* workflows

Packages do not contain memories.

Memories remain independent.

---

## Example

SEO Package

Contains:

```text
SEO Domain
SEO Facts
SEO Instructions
SEO Workflows
```

---

## Example

Competitive Intelligence Package

Contains:

```text
Competitor Domain
Search Visibility Domain
Competitive Workflows
```

---

## Example

Social Growth Package

Contains:

```text
Facebook Domain
Instagram Domain
TikTok Domain
Social Growth Workflows
```

---

# Workflows

Workflows are business outcomes.

Domains provide information.

Workflows use that information.

---

## Workflow Example

SEO Audit

Calls:

```text
SEO Domain
Competitor Domain
Strategy Domain
```

Produces:

```text
SEO Audit Report
```

---

## Workflow Example

Competitive Gap Analysis

Calls:

```text
Competitor Domain
SEO Domain
Reputation Domain
Social Domain
```

Produces:

```text
Competitive Gap Report
```

---

## Workflow Example

Monthly Marketing Review

Calls:

```text
Brand Domain
Strategy Domain
Social Domain
SEO Domain
```

Produces:

```text
Marketing Recommendations
```

---

# Layer Separation

The middleware must maintain strict separation.

---

## Observation Providers

Responsible for:

```text
Collect
Normalize
Store
Tag
```

---

## Domains

Responsible for:

```text
Retrieve
Filter
Scope
Assemble
```

---

## Workflows

Responsible for:

```text
Analyze
Compare
Recommend
Report
```

---

# Design Rule

Observation providers should never know:

* which domains exist
* which workflows exist
* how information will be used

Domains should never know:

* which provider produced data
* which workflow will consume data

Workflows should only consume retrieved context.

This ensures:

* modularity
* explainability
* reusability
* deterministic behavior

---

# Final Principle

The middleware is not a collection of tools.

The middleware is an observation retrieval system.

Observation providers create facts.

Domains retrieve facts.

Workflows create outcomes.

This separation is what allows the same middleware to support:

* SEO
* Competitor Analysis
* Marketing
* Sales Intelligence
* Reputation Management
* Lead Operations
* Future business systems

without changing the underlying retrieval architecture.
