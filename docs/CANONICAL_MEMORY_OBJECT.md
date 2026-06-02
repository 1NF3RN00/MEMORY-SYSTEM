# CANONICAL MEMORY OBJECT — V1 AUTHORITATIVE SPECIFICATION

# PURPOSE

The Canonical Memory Object is the foundational system primitive for the memory middleware platform.

ALL ingestion pipelines MUST ultimately produce Canonical Memory Objects.

The Canonical Memory Object is:

* deterministic
* versioned
* observable
* replayable
* traceable
* composable

All downstream systems depend on this structure:

* retrieval
* ranking
* compression
* explainability
* observability
* historian replay
* archival

# CORE PRINCIPLES

## APPEND-ONLY MEMORY

Memory is append-only.

Updates NEVER overwrite existing memory.

New information creates:

* new versions
* new embeddings
* new scoring states

Older memory:

* decays deterministically
* may archive
* remains replayable
* remains lineage traceable

# MEMORY ARCHITECTURE

A Memory Object contains Memory Chunks.

Chunks are NOT independent memory entities.

Memory Objects preserve:

* semantic grouping
* source lineage
* contextual integrity
* observability traceability

# OPERATIONAL VS SOURCE LAYERS

## Operational Layer

Used for:

* retrieval
* ranking
* compression
* context assembly

Contains:

* normalized structured content
* summaries
* chunked representations
* embeddings
* scoring metadata

## Source Truth Layer

Used for:

* auditing
* replay
* debugging
* lineage tracing
* validation

Contains:

* exact raw source
* ingestion traces
* normalization traces
* transformation metadata

Raw source data MUST NEVER be returned directly during retrieval.

# V1 MEMORY OBJECT STRUCTURE

```ts
type MemoryObject = {
  id: string; // ULID

  workspaceId: string;

  version: number;

  parentMemoryId?: string;

  memoryType:
    | "semantic"
    | "episodic"
    | "procedural"
    | "temporal"
    | "strategic";

  persistenceMode:
    | "persistent"
    | "temporary";

  sourceType:
    | "website"
    | "markdown"
    | "json"
    | "text";

  title: string;

  normalizedContent: string;

  summary?: string;

  chunks: MemoryChunk[];

  metadata: {
    sourceUrl?: string;

    sourceLabel?: string;

    tags?: string[];

    createdAtSource?: string;

    ingestionTimestamp: string;

    embeddingVersion: string;

    normalizationVersion: string;
  };

  scoring: {
    importanceScore: number;

    reinforcementScore: number;

    semanticDensityScore: number;

    retrievalCount: number;

    archivalScore: number;
  };

  lineage: {
    sourceMemoryId?: string;

    derivedFrom?: string[];

    ingestionTraceId: string;

    normalizationTraceId: string;
  };

  observability: {
    ingestionLatencyMs?: number;

    normalizationLatencyMs?: number;

    embeddingLatencyMs?: number;

    chunkCount: number;

    tokenCount: number;

    retrievalEligible: boolean;

    archived: boolean;
  };

  createdAt: string;

  updatedAt: string;

  archivedAt?: string;
};
```

# MEMORY CHUNK STRUCTURE

```ts
type MemoryChunk = {
  id: string; // ULID

  memoryId: string;

  chunkIndex: number;

  content: string;

  tokenCount: number;

  embedding?: number[];

  embeddingStatus:
    | "pending"
    | "completed"
    | "failed";

  semanticDensityScore?: number;

  metadata: {
    chunkingStrategy: string;

    overlapPrevious?: boolean;

    overlapNext?: boolean;
  };

  observability: {
    embeddingLatencyMs?: number;

    retrievalCount: number;
  };

  createdAt: string;
};
```

# NORMALIZATION RULES

Normalization is interface-driven.

Default priority:

1. deterministic parsing
2. structural extraction
3. schema validation
4. optional LLM structuring ONLY if required

The normalization layer MUST NEVER:

* invent information
* mutate meaning
* infer unsupported claims
* rewrite source truth

The normalization layer MAY:

* reorganize structure
* classify sections
* extract metadata
* generate deterministic summaries
* produce canonical formatting

# WEBSITE INGESTION RULES

V1 website ingestion flow:

Website
→ crawler extraction
→ structural cleanup
→ markdown normalization
→ optional LLM structuring
→ canonical memory object

DO NOT:

* embed raw HTML directly
* chunk raw DOM structures
* retrieve navigation noise

# TEMPORARY MEMORY RULES

Temporary memory:

* participates in retrieval
* participates in ranking
* participates in compression

BUT:

* expires after query completion
* archives into replay systems
* is excluded from operational persistent memory

# EMBEDDING RULES

V1 embedding rules:

* OpenAI embeddings only
* single global embedding model
* embeddings stored directly on chunk records
* embedding versions tracked
* failed embeddings allowed

If embeddings fail:

* ingestion may continue
* observability must record failure
* retrieval eligibility may downgrade

# CHUNKING RULES

V1 chunking is deterministic.

DO NOT implement:

* adaptive chunking
* graph chunking
* semantic chunk prediction

V1 chunking should prioritize:

* reproducibility
* observability
* debuggability
* benchmarkability

# OBSERVABILITY RULES

All major operations MUST emit events.

Including:

* ingestion
* normalization
* chunking
* embeddings
* archival
* scoring updates

All memory operations must remain:

* traceable
* replayable
* inspectable
* explainable

# FINAL PRINCIPLE

The Canonical Memory Object is the foundational truth structure of the system.

All contextual intelligence systems are downstream consumers of this object.
