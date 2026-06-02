# Processed Input Specification

## Overview

The ProcessedInput object is the canonical runtime intelligence object of the middleware.

The middleware never operates directly on raw user input.

All downstream systems consume:
structured semantic input.

The purpose of the input processor is to transform:
raw language
into:
structured semantic intelligence.

The ProcessedInput object standardizes:

* retrieval routing
* orchestration behavior
* lead detection
* memory retrieval
* workflow triggering
* context construction
* retry handling
* analytics

ProcessedInput is the middleware’s internal semantic language.

---

# Core Philosophy

Raw user input is:

* ambiguous
* noisy
* inconsistent
* inefficient for orchestration

The middleware performs:
semantic preprocessing before retrieval or orchestration.

The language model should receive:
structured contextual intelligence,
not raw conversational chaos.

The middleware prioritizes:
deterministic preprocessing over model improvisation.

---

# Input Processing Lifecycle

```txt id="jlwm91"
Raw Input
↓
Normalization
↓
Keyword Extraction
↓
Phrase Extraction
↓
Intent Classification
↓
Entity Extraction
↓
Signal Detection
↓
Urgency Detection
↓
Lead Detection
↓
Retrieval Hint Generation
↓
Strategy Recommendation
↓
ProcessedInput Object
```

---

# Canonical ProcessedInput

```ts id="jlwm71"
interface ProcessedInput {
  input_id: string

  client_id: string

  raw_input: string

  normalized_input: string

  keywords: string[]

  phrases: string[]

  entities: {
    entity_type: string
    entity_value: string
    confidence?: number
  }[]

  intent: {
    primary_intent: string

    secondary_intents?: {
      intent: string
      confidence: number
    }[]

    confidence?: number
  }

  signals: {
    pricing_interest?: number

    booking_interest?: number

    urgency?: number

    frustration?: number

    confusion?: number

    lead_intent?: number

    escalation_risk?: number
  }

  retrieval: {
    retrieval_strategy?: string

    semantic_weight?: number

    keyword_weight?: number

    metadata_weight?: number

    relationship_expansion?: boolean

    temporal_boost?: boolean

    source_priorities?: string[]
  }

  orchestration: {
    recommended_workflow?: string

    retry_strategy?: string

    compression_level?: string

    token_budget?: number

    escalation_recommended?: boolean
  }

  governance: {
    access_scope?:
      | "public"
      | "private"
      | "internal"

    restricted_topics?: string[]
  }

  analytics: {
    processing_time_ms?: number

    preprocessing_version?: string
  }

  timestamps: {
    created_at: string
  }
}
```

---

# Stage 1: Normalization

The middleware normalizes raw input before processing.

Normalization includes:

* punctuation cleanup
* whitespace cleanup
* encoding normalization
* case normalization
* formatting cleanup

Normalization attempts to preserve:
semantic meaning while removing noise.

The purpose is:
semantic consistency,
not linguistic perfection.

---

# Stage 2: Keyword Extraction

The middleware extracts statistical keywords.

Keyword extraction supports:

* lightweight retrieval
* lexical scoring
* retrieval hints
* metadata boosting

Keyword extraction is deterministic.

Keywords are:
retrieval assets,
not final semantic understanding.

---

# Stage 3: Phrase Extraction

The middleware extracts:
multi-word semantic phrases.

Phrase extraction supports:

* business-specific terminology
* retrieval precision
* metadata matching
* contextual ranking

Phrase extraction improves:
semantic density and retrieval specificity.

Examples:

* roof replacement financing
* emergency plumbing repair
* annual maintenance agreement

Phrases are first-class retrieval signals.

---

# Stage 4: Intent Classification

The middleware classifies:
semantic intent.

Intent classification determines:

* retrieval strategy
* orchestration behavior
* retry logic
* workflow routing
* lead handling

Examples:

* informational
* pricing
* troubleshooting
* booking
* support
* comparison
* escalation

Intent classification is deterministic-first.

---

# Stage 5: Entity Extraction

The middleware extracts semantic entities.

Examples:

* products
* services
* locations
* people
* dates
* plans
* business terms

Entities support:

* retrieval precision
* metadata filtering
* relationship traversal
* contextual understanding

Entities are structured retrieval intelligence.

---

# Stage 6: Signal Detection

The middleware detects operational signals.

Examples:

* pricing interest
* urgency
* frustration
* confusion
* escalation risk
* lead intent

Signals are weighted numerically.

Example:

```json id="jlwm73"
{
  "pricing_interest": 0.92,
  "urgency": 0.81
}
```

Signals influence:
retrieval,
orchestration,
and workflow behavior.

---

# Stage 7: Retrieval Hint Generation

The middleware generates:
retrieval recommendations.

Examples:

* pricing boost
* source prioritization
* relationship expansion
* temporal boosting
* metadata weighting

The retrieval engine consumes:
structured retrieval hints,
not raw input assumptions.

---

# Stage 8: Strategy Recommendation

The middleware recommends:
orchestration strategies.

Examples:

* retry strategy
* compression level
* token budget
* escalation handling
* workflow selection

Strategies remain:
deterministic,
configurable,
and traceable.

---

# Precision-First Processing

The middleware prioritizes:
high-quality semantic preprocessing.

The middleware avoids:

* oversized context windows
* raw transcript dumping
* broad uncontrolled retrieval
* prompt-heavy orchestration

The input processor reduces entropy before retrieval begins.

---

# Input Processor Philosophy

The input processor is:
semantic preprocessing infrastructure.

The input processor is not:
a chatbot feature.

All downstream systems consume:
ProcessedInput objects.

The input processor is reusable across:

* chatbots
* APIs
* report generators
* memory systems
* agents
* workflows
* semantic search
* automation systems

---

# Deterministic Preprocessing

The middleware prioritizes:
deterministic preprocessing systems.

Examples:

* keyword extraction
* phrase extraction
* weighted scoring
* config-driven routing
* retrieval hints

The middleware may support:
future lightweight classifiers.

Core preprocessing behavior remains:
observable,
traceable,
and configurable.

---

# Analytics Tracking

The middleware tracks:

* preprocessing latency
* extraction quality
* retrieval effectiveness
* signal performance
* orchestration success

Analytics support:

* optimization
* debugging
* reranking improvements
* orchestration tuning

The middleware values:
observability and deterministic optimization.

---

# Governance Awareness

ProcessedInput objects support governance-aware orchestration.

Examples:

* restricted retrieval scopes
* internal-only workflows
* access-limited queries

Governance-aware preprocessing supports:
safe retrieval infrastructure.

---

# Final Principle

ProcessedInput is the middleware’s universal semantic runtime language.

The middleware transforms:
raw human language
into:
structured semantic intelligence.

All downstream middleware systems consume:
ProcessedInput objects,
not raw conversational input.
