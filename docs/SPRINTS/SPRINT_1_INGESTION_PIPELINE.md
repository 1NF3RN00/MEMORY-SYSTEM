# SPRINT 1 — INGESTION + CANONICAL MEMORY PIPELINE

# SPRINT OBJECTIVE

Build the first complete deterministic memory ingestion pipeline.

This sprint establishes:

* ingestion flow
* canonical memory generation
* deterministic chunking
* embedding lifecycle
* async processing
* source truth preservation
* ingestion observability
* replay traceability

At the end of Sprint 1, the system should successfully transform supported inputs into fully structured Canonical Memory Objects.

# PRIMARY GOAL

Build a complete operational flow:

Raw Input
→ Validation
→ Structural Processing
→ Optional LLM Normalization
→ Canonical Memory Object
→ Chunking
→ Embedding Generation
→ Storage
→ Event Emission
→ Observability Trace

# PRIMARY V1 PRINCIPLE

Precision-focused contextual memory infrastructure.

NOT:

* generic ingestion
* raw vector dumping
* naive chunk storage
* autonomous interpretation

# SUPPORTED INPUT TYPES — SPRINT 1 ONLY

ONLY support:

* markdown
* plain text
* JSON
* websites

DO NOT implement:

* PDFs
* OCR
* images
* audio
* video
* emails
* spreadsheets

# WEBSITE INGESTION RULES

Website ingestion is REQUIRED in Sprint 1.

Website ingestion flow:

Website
→ crawler extraction
→ structural cleanup
→ markdown normalization
→ optional LLM structuring
→ canonical memory object

DO NOT:

* embed raw HTML
* chunk raw DOM trees
* store navigation garbage
* retrieve footer noise
* retrieve boilerplate site content

Website processing should prioritize:

* semantic density
* retrieval cleanliness
* token efficiency
* structural consistency

# NORMALIZATION PHILOSOPHY

Normalization is INTERFACE-BASED.

Default order:

1. deterministic parsing
2. structural extraction
3. schema validation
4. optional LLM-assisted structuring ONLY when required

LLM normalization is NOT default behavior.

LLM normalization exists ONLY for:

* structural cleanup
* section extraction
* metadata extraction
* canonical organization

LLM normalization MUST NEVER:

* invent information
* rewrite meaning
* infer unsupported claims
* fabricate metadata

# REQUIRED PIPELINE COMPONENTS

Implement:

## Ingestion API

* ingestion endpoint
* ingestion validation
* persistence mode support
* source type support
* async job submission

## Async Processing Pipeline

* ingestion queue
* deterministic job lifecycle
* retry support
* failure observability
* processing state tracking

## Canonical Memory Builder

* memory object generation
* metadata population
* lineage creation
* observability metadata generation

## Chunking Engine

* deterministic chunking
* overlap support
* token estimation
* chunk metadata generation

## Embedding Pipeline

* OpenAI embeddings
* embedding version tracking
* embedding failure handling
* degraded ingestion support

## Storage Layer

* memory persistence
* chunk persistence
* source truth storage
* trace persistence

## Event Emission

Emit events for:

* ingestion started
* normalization completed
* chunking completed
* embedding completed
* embedding failed
* ingestion completed
* ingestion archived
* temporary memory expired

# REQUIRED DATABASE EXTENSIONS

Extend existing database schema to support:

* memory versions
* lineage tracking
* embedding versions
* ingestion traces
* normalization traces
* archival state
* temporary memory expiration
* chunk embedding status

# REQUIRED API CONTRACTS

Implement:

* POST /ingest
* GET /memory/:id
* GET /memory/:id/chunks
* GET /ingestion/:traceId
* GET /events/:traceId

DO NOT implement retrieval APIs yet.

# REQUIRED INGESTION STATES

Implement deterministic ingestion states:

```text id="o1kt3z"
pending
processing
normalized
chunked
embedded
stored
completed
failed
archived
```

# REQUIRED OBSERVABILITY

Dashboard MUST expose:

## Ingestion Trace Viewer

* ingestion stages
* failures
* latencies
* normalization traces

## Memory Explorer

* canonical memory inspection
* chunk inspection
* metadata inspection

## Chunk Viewer

* chunk boundaries
* token counts
* embedding status

## Event Timeline

* ingestion events
* normalization events
* embedding events
* archival events

# REQUIRED SOURCE TRUTH STORAGE

Store:

* exact raw source
* crawler output
* normalization transformations
* ingestion traces

Source truth data:

* MUST remain replayable
* MUST remain inspectable
* MUST NEVER directly participate in retrieval

# REQUIRED TEMPORARY MEMORY BEHAVIOR

Temporary memory:

* participates in ingestion normally
* participates in embedding normally
* participates in chunking normally

BUT:

* expires after query completion
* archives into replay systems
* becomes retrieval-ineligible operationally

# REQUIRED FAILURE HANDLING

System must degrade gracefully.

Embedding failure MUST NOT destroy ingestion.

Instead:

* preserve memory object
* preserve chunks
* mark embedding status failed
* emit observability events
* preserve replayability

# REQUIRED CHUNKING RULES

Sprint 1 chunking MUST be deterministic.

Implement:

* fixed token chunk sizing
* configurable overlap
* deterministic ordering

DO NOT implement:

* semantic chunking
* adaptive chunking
* graph chunking
* hierarchical chunking

# REQUIRED EVENT RULES

Every major operation emits structured events.

Events must include:

* operation type
* timestamp
* latency
* trace ID
* memory ID
* workspace ID
* success/failure state

# EXPLICITLY OUT OF SCOPE

DO NOT implement:

* retrieval engine
* ranking systems
* compression systems
* reinforcement systems
* graph systems
* orchestration engines
* predictive systems
* multimodal systems
* workflow systems

# ACCEPTANCE CRITERIA

Sprint 1 is complete when:

* markdown ingestion works
* JSON ingestion works
* website ingestion works
* canonical memory objects generate successfully
* deterministic chunking works
* embeddings generate successfully
* failed embeddings degrade gracefully
* async ingestion pipeline works
* events emit correctly
* ingestion observability works
* dashboard ingestion traces work
* raw source truth persists correctly
* temporary memory expiration works

# IMPLEMENTATION PRIORITY

Implement in this order:

1. ingestion contracts
2. ingestion API
3. async ingestion pipeline
4. canonical memory builder
5. deterministic chunker
6. embedding pipeline
7. source truth storage
8. ingestion event system
9. ingestion observability
10. dashboard ingestion views

# FINAL SPRINT RULE

This sprint exists to establish deterministic contextual memory ingestion infrastructure.

DO NOT expand into retrieval or intelligence systems yet.
