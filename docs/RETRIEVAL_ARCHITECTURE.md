# RETRIEVAL ARCHITECTURE — V1 AUTHORITATIVE SPECIFICATION

# PURPOSE

The Retrieval Engine is the core operational intelligence layer of the memory middleware platform.

The retrieval system is NOT:

* naive vector search
* generic semantic lookup
* maximum recall infrastructure
* autonomous reasoning

The retrieval system IS:

* deterministic contextual assembly infrastructure
* precision-focused contextual retrieval
* explainable ranking infrastructure
* token-efficient contextual intelligence assembly

# PRIMARY OPTIMIZATION TARGET

HIGHEST RETRIEVAL PRECISION PER TOKEN

All retrieval behavior must prioritize:

1. semantic precision
2. contextual integrity
3. token efficiency
4. freshness
5. importance weighting

# CORE RETRIEVAL PRINCIPLE

The system retrieves:

* contextual intelligence packages

NOT:

* disconnected vector matches

# RETRIEVAL MODEL

V1 retrieval is HYBRID.

The retrieval process:

* retrieves chunks
* assembles context by memory object

Chunks exist for:

* retrieval precision
* embedding similarity
* token granularity

Memory Objects exist for:

* contextual integrity
* lineage
* explainability
* semantic grouping

# RETRIEVAL PIPELINE

V1 retrieval pipeline:

Query
→ deterministic preprocessing
→ scope filtering
→ vector retrieval
→ deterministic reranking
→ semantic deduplication
→ token budgeting
→ context assembly
→ retrieval explanation generation

# QUERY PREPROCESSING RULES

V1 preprocessing is MINIMAL and deterministic.

Allowed preprocessing:

* normalization
* token cleanup
* keyword extraction
* stopword handling
* simple query parsing

DO NOT implement:

* query rewriting
* autonomous decomposition
* intent inference
* LLM query expansion
* predictive retrieval planning

# RETRIEVAL SCOPE RULES

Retrieval is workspace-scoped by default.

Every retrieval operation MUST:

* specify workspace scope
* maintain tenant isolation
* preserve contextual boundaries

Global retrieval is OUT OF SCOPE for V1.

# RETRIEVAL UNIT RULES

## Retrieval Unit

Chunk

## Assembly Unit

Memory Object

The retrieval engine:

* retrieves semantically relevant chunks
* groups results by parent memory object
* assembles contextual packages deterministically

# VECTOR RETRIEVAL RULES

V1 vector retrieval:

* uses pgvector
* uses embedding similarity
* uses deterministic thresholds
* remains fully observable

DO NOT implement:

* graph traversal
* adaptive semantic expansion
* neural reranking
* autonomous retrieval exploration

# RANKING PHILOSOPHY

V1 ranking is FULLY deterministic.

Ranking exists to:

* improve contextual precision
* reduce irrelevant token usage
* prioritize operationally valuable memory

# RANKING MODEL

V1 ranking model:

```text id="hxz8a6"
finalScore =
semanticSimilarity
+ importanceWeight
+ recencyWeight
+ reinforcementWeight
+ semanticDensityWeight
```

# IMPORTANT RANKING RULE

Ranking infrastructure MUST remain modular.

Weights and ranking inputs:

* MUST remain configurable
* MUST remain observable
* MUST remain replayable
* MUST remain benchmarkable

DO NOT hardcode ranking assumptions permanently.

# RERANKING RULES

Reranking occurs BEFORE deduplication.

Pipeline:

retrieve
→ rerank
→ deduplicate weaker overlaps

Reason:

* similar chunks may contain different operational value
* ranking determines strongest contextual candidates
* deduplication should preserve highest-ranked context

# DEDUPLICATION RULES

Deduplication is:

* semantic
* deterministic
* post-ranking

Deduplication should:

* remove redundant contextual overlap
* preserve contextual diversity
* preserve higher-ranked candidates

DO NOT aggressively collapse semantically adjacent context.

# TOKEN BUDGETING RULES

Sprint 2 token budgeting is TRIM-ONLY.

The system:

* removes lowest-ranked context first
* preserves highest-value contextual packages

DO NOT implement:

* compression summarization
* adaptive compression
* semantic collapsing
* dynamic abstraction

Compression infrastructure arrives later in V1.

# CONTEXT ASSEMBLY RULES

Context assembly builds structured contextual intelligence packages.

Context packages MUST preserve:

* retrieval order
* ranking traceability
* source lineage
* contextual grouping
* observability metadata

# REQUIRED CONTEXT PACKAGE STRUCTURE

```ts id="z6tb7v"
type ContextPackage = {
  query: string;

  workspaceId: string;

  retrievalTraceId: string;

  tokenBudget: {
    maxTokens: number;

    usedTokens: number;

    trimmedTokens: number;
  };

  retrievalMetadata: {
    retrievalLatencyMs: number;

    retrievedChunkCount: number;

    deduplicatedChunkCount: number;

    finalChunkCount: number;
  };

  memories: RetrievedMemory[];

  rejectedCandidates: RejectedCandidate[];

  rankingBreakdown: RankingBreakdown[];

  generatedAt: string;
};
```

# EXPLAINABILITY REQUIREMENTS

Every retrieval operation MUST produce full retrieval explanations.

Retrieval explanations MUST include:

* semantic similarity
* ranking contributions
* reranking decisions
* deduplication decisions
* rejection reasoning
* token trimming reasoning
* retrieval ordering
* source lineage

# REQUIRED RETRIEVAL TRACE STRUCTURE

```json id="a1hdtm"
{
  "memoryId": "...",
  "chunkId": "...",
  "semanticSimilarity": 0.92,
  "importanceBoost": 0.11,
  "recencyBoost": 0.04,
  "reinforcementBoost": 0.03,
  "semanticDensityBoost": 0.02,
  "finalScore": 1.12,
  "retrievalReasons": [
    "high semantic similarity",
    "high semantic density",
    "recent reinforcement"
  ],
  "deduplicationDecision": "kept",
  "tokenBudgetDecision": "included"
}
```

# OBSERVABILITY RULES

Every retrieval stage MUST emit events.

Including:

* query preprocessing
* vector retrieval
* reranking
* deduplication
* token trimming
* context assembly
* retrieval completion

All retrieval operations must remain:

* replayable
* inspectable
* benchmarkable
* traceable

# DASHBOARD REQUIREMENTS

Dashboard MUST expose:

* retrieval traces
* ranking breakdowns
* rejected candidates
* token trimming decisions
* retrieval heatmaps
* retrieval latency
* retrieval replay
* contextual package inspection

# EXPLICITLY OUT OF SCOPE

DO NOT implement:

* graph retrieval
* predictive retrieval
* adaptive query planning
* ML reranking
* autonomous retrieval agents
* compression summarization
* multimodal retrieval
* federated retrieval

# FINAL PRINCIPLE

The retrieval engine exists to construct:
high-precision contextual intelligence packages
with maximal explainability and minimal token waste.

