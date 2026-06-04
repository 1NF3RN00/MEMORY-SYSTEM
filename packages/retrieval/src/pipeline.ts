import type { EmbeddingClient } from "@memory-middleware/ingestion";
import { createOpenAiEmbeddingClient } from "@memory-middleware/ingestion";
import type { EventEmitter } from "@memory-middleware/observability";
import type {
  ContextPackage,
  DomainExecutionContext,
  RejectedCandidate,
  RelationshipAugmentationResult,
  RetrievalCalibrationControls,
  RetrievalPlan,
  RetrievalQuery,
  RetrievalRuntimeConfig,
  RetrievalStageRecord,
} from "@memory-middleware/shared-types";
import { applyRelationshipAugmentation } from "@memory-middleware/relationship";
import { newUlid } from "@memory-middleware/shared-types";
import { assembleContextPackage } from "./assembly.js";
import {
  applyRetrievalExpansion,
  type ChunkAdjacencyLookup,
} from "./expansion.js";
import { emitRetrievalExpansionApplied } from "@memory-middleware/structural";
import type { ChunkRowForAssembly, MemoryRowForAssembly } from "./assembly.js";
import { mergeRetrievalConfig } from "./config.js";
import {
  deduplicateChunks,
  deduplicationRejections,
} from "./deduplication.js";
import {
  emitContextAssemblyCompleted,
  emitDeduplicationCompleted,
  emitPreprocessingCompleted,
  emitRerankingCompleted,
  emitRetrievalCompleted,
  emitRetrievalFailed,
  emitRetrievalStarted,
  emitTokenBudgetingCompleted,
  emitVectorRetrievalCompleted,
} from "./events.js";
import { preprocessQuery, validateRetrievalScope } from "./preprocessing.js";
import { rankChunks, type RankableChunk } from "./ranking.js";
import { applyTokenBudget, tokenBudgetRejections } from "./token-budget.js";
import {
  applySimilarityThreshold,
  type VectorSearchStore,
} from "./vector-retrieval.js";
import { resolveCalibratedRetrievalParams } from "./threshold-calibration.js";
import {
  filterRelationshipsByNeighborhoodConstraints,
  resolveDomainRetrievalScope,
} from "./domain-scope.js";

export interface RunRetrievalInput {
  query: RetrievalQuery;
  traceId?: string;
  config?: RetrievalRuntimeConfig;
  vectorStore: VectorSearchStore;
  embeddingClient: EmbeddingClient | null;
  events: EventEmitter;
  onStage?: (stages: RetrievalStageRecord[]) => void;
  /** Load chunk adjacency for contextual neighbor hints (called with retrieved chunk IDs) */
  loadAdjacencyForChunks?: (
    chunkIds: string[],
  ) => Promise<Map<string, ChunkAdjacencyLookup>>;
  /** Load memory metadata for retrieval expansion */
  loadMemoryMetadata?: (
    memoryIds: string[],
  ) => Promise<
    Array<{ memoryId: string; title: string; memoryType: string; tags?: string[] }>
  >;
  /** Sprint 7 — load relationships for bounded augmentation (depth=1) */
  loadRelationshipsForMemories?: (
    memoryIds: string[],
  ) => Promise<
    Array<{
      sourceMemoryId: string;
      targetMemoryId: string;
      relationshipType: string;
      confidence: number;
      weight: number;
      generatedFrom: string[];
    }>
  >;
  /** Sprint 6 — optional retrieval plan for contextual weighting and hints */
  retrievalPlan?: RetrievalPlan;
  /** Workspace calibration controls for threshold/top-K tuning */
  calibration?: Partial<RetrievalCalibrationControls>;
  /** Domain Engine — task-scoped operational context */
  executionContext?: DomainExecutionContext;
  /** Load target memory metadata for relationship neighborhood constraints */
  loadTargetMemoryMetadata?: (
    memoryIds: string[],
  ) => Promise<Map<string, Record<string, unknown>>>;
}

export interface RunRetrievalResult {
  traceId: string;
  contextPackage: ContextPackage;
  stages: RetrievalStageRecord[];
  preprocessedQuery: ReturnType<typeof preprocessQuery>;
  relationshipAugmentation?: RelationshipAugmentationResult;
  executionContext?: DomainExecutionContext;
}

function pushStage(
  stages: RetrievalStageRecord[],
  stage: string,
  status: RetrievalStageRecord["status"],
  startedAt: string,
  extra?: Partial<RetrievalStageRecord>,
): void {
  const existing = stages.find((s) => s.stage === stage && s.status === "started");
  if (existing && status === "completed") {
    existing.status = "completed";
    existing.completedAt = new Date().toISOString();
    existing.latencyMs = Date.now() - new Date(existing.startedAt).getTime();
    if (extra?.metadata) existing.metadata = { ...existing.metadata, ...extra.metadata };
    return;
  }
  stages.push({
    stage,
    status,
    startedAt,
    ...extra,
  });
}

export async function runRetrievalPipeline(
  input: RunRetrievalInput,
): Promise<RunRetrievalResult> {
  const traceId = input.traceId ?? newUlid();
  const config = input.config ?? mergeRetrievalConfig();
  const stages: RetrievalStageRecord[] = [];
  const pipelineStarted = Date.now();

  const notify = async () => {
    await input.onStage?.([...stages]);
  };

  const scope = validateRetrievalScope({
    workspaceId: input.query.workspaceId,
    query: input.query.query,
    tokenBudget: input.query.tokenBudget,
  });

  if (!scope.valid) {
    throw new Error(`Invalid retrieval scope: ${scope.errors.join("; ")}`);
  }

  const domainScope = resolveDomainRetrievalScope(input.query, input.executionContext);
  const effectiveQuery = domainScope.query;

  await emitRetrievalStarted(input.events, {
    traceId,
    workspaceId: input.query.workspaceId,
    extra: {
      retrieval_mode: input.query.retrievalMode,
      ...(input.executionContext?.domainKey
        ? { domain_key: input.executionContext.domainKey }
        : {}),
      ...(input.executionContext?.domainAction
        ? { domain_action: input.executionContext.domainAction }
        : {}),
    },
  });

  if (input.executionContext) {
    pushStage(stages, "domain_execution_context", "completed", new Date().toISOString(), {
      metadata: {
        domain_key: input.executionContext.domainKey,
        domain_action: input.executionContext.domainAction,
        global_fact_count: input.executionContext.globalFacts.length,
        domain_fact_count: input.executionContext.domainFacts.length,
        metadata_filter_count: input.executionContext.metadataFilters.length,
        retrieval_rule_count: input.executionContext.retrievalRules.length,
      },
    });
  }

  pushStage(stages, "preprocessing", "started", new Date().toISOString());
  await notify();

  const preprocessOptions: import("./preprocessing.js").PreprocessQueryOptions = {
    ...(input.retrievalPlan?.expansionTerms?.length
      ? { expansionTerms: input.retrievalPlan.expansionTerms }
      : {}),
    ...(input.retrievalPlan?.decomposition
      ? { decomposition: input.retrievalPlan.decomposition }
      : {}),
  };
  const preprocessed = preprocessQuery(effectiveQuery.query, preprocessOptions);
  const calibratedParams = resolveCalibratedRetrievalParams(
    input.calibration,
    input.query.retrievalMode,
    config,
  );
  const preprocessStarted = Date.now();
  pushStage(stages, "preprocessing", "completed", new Date().toISOString(), {
    metadata: {
      keywords: preprocessed.keywords,
      token_count: preprocessed.tokenCount,
      operational_concepts: preprocessed.operationalConcepts ?? [],
      domains: preprocessed.domains ?? [],
      embedding_enriched: Boolean(preprocessed.embeddingText),
    },
  });
  await emitPreprocessingCompleted(input.events, {
    traceId,
    workspaceId: input.query.workspaceId,
    latencyMs: Date.now() - preprocessStarted,
    extra: { keywords: preprocessed.keywords },
  });
  await notify();

  if (!input.embeddingClient) {
    const err = "Embedding client not configured — cannot embed query for vector retrieval";
    pushStage(stages, "vector_retrieval", "failed", new Date().toISOString(), { error: err });
    await emitRetrievalFailed(input.events, {
      traceId,
      workspaceId: input.query.workspaceId,
      error: err,
    });
    await notify();
    throw new Error(err);
  }

  pushStage(stages, "vector_retrieval", "started", new Date().toISOString());
  await notify();

  const vectorStarted = Date.now();
  let queryEmbedding: number[];
  try {
    const embeddingInput = preprocessed.embeddingText ?? preprocessed.normalizedQuery;
    const vectors = await input.embeddingClient.embed([embeddingInput]);
    queryEmbedding = vectors[0] ?? [];
    if (queryEmbedding.length === 0) throw new Error("Empty query embedding returned");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    pushStage(stages, "vector_retrieval", "failed", new Date().toISOString(), { error: message });
    await emitRetrievalFailed(input.events, {
      traceId,
      workspaceId: input.query.workspaceId,
      error: message,
    });
    await notify();
    throw error;
  }

  const topK = calibratedParams.topK;
  const similarityThreshold = calibratedParams.similarityThreshold;

  const expansionKeywords = [
    ...preprocessed.keywords,
    ...(preprocessed.operationalConcepts ?? []).slice(0, 8),
    ...(preprocessed.domains ?? []),
    ...(input.retrievalPlan?.expansionTerms ?? []).slice(0, 12),
  ];
  const scannedCandidates = await input.vectorStore.search(
    queryEmbedding,
    domainScope.filter,
    topK,
  );

  const thresholdResult = applySimilarityThreshold(scannedCandidates, similarityThreshold);
  const vectorCandidates = thresholdResult.candidates;
  const rejected: RejectedCandidate[] = [...thresholdResult.rejected];

  if (scannedCandidates.length === 0) {
    rejected.push({
      memoryId: "",
      chunkId: "",
      reason: "below_similarity_threshold",
      detail: "No eligible chunks with embeddings found in workspace",
    });
  } else if (vectorCandidates.length === 0) {
    rejected.push({
      memoryId: "",
      chunkId: "",
      reason: "below_similarity_threshold",
      detail: thresholdResult.retried
        ? `No chunks met relaxed threshold ${thresholdResult.effectiveThreshold.toFixed(2)} (retried from ${similarityThreshold.toFixed(2)})`
        : `No chunks met similarity threshold ${thresholdResult.effectiveThreshold.toFixed(2)}`,
    });
  }

  pushStage(stages, "vector_retrieval", "completed", new Date().toISOString(), {
    metadata: {
      candidate_count: vectorCandidates.length,
      scanned_count: scannedCandidates.length,
      rejected_below_threshold: thresholdResult.rejected.length,
      top_k: topK,
      threshold: thresholdResult.effectiveThreshold,
      base_threshold: similarityThreshold,
      threshold_mode: calibratedParams.thresholdMode,
      breadth_multiplier: calibratedParams.breadthMultiplier,
      precision_weighting: calibratedParams.precisionWeighting,
      ...(thresholdResult.retried ? { threshold_retried: true } : {}),
    },
  });
  await emitVectorRetrievalCompleted(input.events, {
    traceId,
    workspaceId: input.query.workspaceId,
    latencyMs: Date.now() - vectorStarted,
    extra: { candidate_count: vectorCandidates.length },
  });
  await notify();

  pushStage(stages, "reranking", "started", new Date().toISOString());
  await notify();

  const rankable: RankableChunk[] = vectorCandidates.map((c) => ({
    memoryId: c.memoryId,
    chunkId: c.chunkId,
    semanticSimilarity: c.semanticSimilarity,
    importanceScore: c.importanceScore,
    reinforcementScore: c.reinforcementScore,
    semanticDensityScore: c.semanticDensityScore,
    memoryUpdatedAt: c.memoryUpdatedAt,
  }));

  const rerankStarted = Date.now();
  let { ranked, breakdown } = rankChunks(
    rankable,
        config,
        input.retrievalPlan?.weightingAdjustments,
        calibratedParams.precisionWeighting,
      );

  let relationshipAugmentation: RelationshipAugmentationResult | undefined;

  if (input.loadRelationshipsForMemories && ranked.length > 0) {
    const topMemoryIds = [...new Set(ranked.slice(0, 20).map((r) => r.memoryId))];
    let relationships = await input.loadRelationshipsForMemories(topMemoryIds);

    if (input.executionContext && relationships.length > 0) {
      const neighborIds = new Set<string>();
      for (const r of relationships) {
        neighborIds.add(r.sourceMemoryId);
        neighborIds.add(r.targetMemoryId);
      }
      const targetMetadata = input.loadTargetMemoryMetadata
        ? await input.loadTargetMemoryMetadata([...neighborIds])
        : new Map<string, Record<string, unknown>>();
      relationships = filterRelationshipsByNeighborhoodConstraints(
        relationships,
        domainScope.relationshipConstraints,
        targetMetadata,
      );
    }

    if (relationships.length > 0) {
      const { result, adjustedCandidates } = applyRelationshipAugmentation({
        retrievedMemoryIds: topMemoryIds,
        relationships: relationships.map((r) => ({
          sourceMemoryId: r.sourceMemoryId,
          targetMemoryId: r.targetMemoryId,
          relationshipType: r.relationshipType as import("@memory-middleware/shared-types").RelationshipType,
          confidence: r.confidence,
          weight: r.weight,
          generatedFrom: r.generatedFrom,
        })),
        rankedCandidates: ranked.map((r) => ({
          memoryId: r.memoryId,
          chunkId: r.chunkId,
          finalScore: r.finalScore,
          semanticSimilarity: r.semanticSimilarity,
        })),
        config: domainScope.relationshipConfig,
      });

      relationshipAugmentation = result;

      if (result.rankingImpacts.length > 0) {
        const scoreByChunk = new Map(
          adjustedCandidates.map((c) => [c.chunkId, c.finalScore]),
        );
        ranked = ranked
          .map((r) => ({
            ...r,
            finalScore: scoreByChunk.get(r.chunkId) ?? r.finalScore,
          }))
          .sort((a, b) => b.finalScore - a.finalScore)
          .map((r, index) => ({ ...r, rankingRank: index + 1 }));

        breakdown = breakdown.map((b) => {
          const impact = result.rankingImpacts.find((i) => i.chunkId === b.chunkId);
          if (!impact) return b;
          return { ...b, finalScore: impact.augmentedScore, rankingRank: ranked.find((r) => r.chunkId === b.chunkId)?.rankingRank ?? b.rankingRank };
        });
      }
    }
  }

  pushStage(stages, "reranking", "completed", new Date().toISOString(), {
    metadata: {
      ranked_count: ranked.length,
      ...(relationshipAugmentation?.augmentationApplied
        ? { relationship_augmentation: relationshipAugmentation.neighborCount }
        : {}),
    },
  });
  await emitRerankingCompleted(input.events, {
    traceId,
    workspaceId: input.query.workspaceId,
    latencyMs: Date.now() - rerankStarted,
    extra: { ranked_count: ranked.length },
  });
  await notify();

  pushStage(stages, "deduplication", "started", new Date().toISOString());
  await notify();

  const contents = new Map<string, string>();
  const chunkRows = new Map<string, ChunkRowForAssembly>();
  const memories = new Map<string, MemoryRowForAssembly>();

  for (const c of vectorCandidates) {
    contents.set(c.chunkId, c.content);
    chunkRows.set(c.chunkId, {
      id: c.chunkId,
      memoryId: c.memoryId,
      sequence: c.sequence,
      content: c.content,
      tokenCount: c.tokenCount,
    });
    if (!memories.has(c.memoryId)) {
      memories.set(c.memoryId, {
        id: c.memoryId,
        title: c.title,
        memoryType: c.memoryType,
        version: c.version,
        summary: c.summary,
        ingestionTraceId: c.ingestionTraceId,
        normalizationTraceId: c.normalizationTraceId,
      });
    }
  }

  const dedupStarted = Date.now();
  const dedup = deduplicateChunks(ranked, contents, config);
  rejected.push(...deduplicationRejections(dedup.removed));
  pushStage(stages, "deduplication", "completed", new Date().toISOString(), {
    metadata: {
      kept: dedup.kept.length,
      removed: dedup.removed.length,
    },
  });
  await emitDeduplicationCompleted(input.events, {
    traceId,
    workspaceId: input.query.workspaceId,
    latencyMs: Date.now() - dedupStarted,
    extra: { kept: dedup.kept.length, removed: dedup.removed.length },
  });
  await notify();

  pushStage(stages, "token_budgeting", "started", new Date().toISOString());
  await notify();

  const withTokens = dedup.kept.map((r) => ({
    ...r,
    tokenCount: chunkRows.get(r.chunkId)?.tokenCount ?? 0,
  }));

  const budgetStarted = Date.now();
  const tokenBudget = applyTokenBudget({
    chunks: withTokens,
    maxTokens: effectiveQuery.tokenBudget,
  });
  rejected.push(...tokenBudgetRejections(tokenBudget.trimmed));
  pushStage(stages, "token_budgeting", "completed", new Date().toISOString(), {
    metadata: {
      used_tokens: tokenBudget.usedTokens,
      trimmed_tokens: tokenBudget.trimmedTokens,
      included: tokenBudget.included.length,
    },
  });
  await emitTokenBudgetingCompleted(input.events, {
    traceId,
    workspaceId: input.query.workspaceId,
    latencyMs: Date.now() - budgetStarted,
    extra: {
      used_tokens: tokenBudget.usedTokens,
      trimmed: tokenBudget.trimmed.length,
    },
  });
  await notify();

  pushStage(stages, "context_assembly", "started", new Date().toISOString());
  await notify();

  const assemblyStarted = Date.now();
  const contextPackage = assembleContextPackage({
    query: effectiveQuery.query,
    workspaceId: effectiveQuery.workspaceId,
    retrievalTraceId: traceId,
    tokenBudget,
    dedup,
    allRanked: ranked,
    memories,
    chunkRows,
    rejectedCandidates: rejected,
    rankingBreakdown: breakdown,
    retrievalLatencyMs: Date.now() - pipelineStarted,
    retrievedChunkCount: vectorCandidates.length,
    maxTokens: effectiveQuery.tokenBudget,
  });

  if (input.executionContext) {
    contextPackage.retrievalMetadata = {
      ...contextPackage.retrievalMetadata,
      ...(input.executionContext.domainKey ? { domainKey: input.executionContext.domainKey } : {}),
      ...(input.executionContext.domainAction
        ? { domainAction: input.executionContext.domainAction }
        : {}),
    };
  }

  pushStage(stages, "context_assembly", "completed", new Date().toISOString(), {
    metadata: { memory_count: contextPackage.memories.length },
  });
  await emitContextAssemblyCompleted(input.events, {
    traceId,
    workspaceId: input.query.workspaceId,
    latencyMs: Date.now() - assemblyStarted,
    extra: { memory_count: contextPackage.memories.length },
  });
  await notify();

  await emitRetrievalCompleted(input.events, {
    traceId,
    workspaceId: input.query.workspaceId,
    latencyMs: Date.now() - pipelineStarted,
    extra: {
      final_chunk_count: contextPackage.retrievalMetadata.finalChunkCount,
    },
  });

  if (input.loadAdjacencyForChunks || input.loadMemoryMetadata) {
    const retrievedChunkIds = contextPackage.memories.flatMap((m) =>
      m.chunks.map((c) => c.chunkId),
    );
    const memoryIds = contextPackage.memories.map((m) => m.memoryId);

    const adjacencyByChunkId = input.loadAdjacencyForChunks
      ? await input.loadAdjacencyForChunks(retrievedChunkIds)
      : new Map<string, ChunkAdjacencyLookup>();

    const memories = input.loadMemoryMetadata
      ? await input.loadMemoryMetadata(memoryIds)
      : contextPackage.memories.map((m) => ({
          memoryId: m.memoryId,
          title: m.title,
          memoryType: m.memoryType,
        }));

    const expansion = applyRetrievalExpansion({
      query: effectiveQuery.query,
      keywords: expansionKeywords,
      retrievedChunkIds,
      memories,
      adjacencyByChunkId,
      ...(input.retrievalPlan?.decomposition
        ? { decomposition: input.retrievalPlan.decomposition }
        : {}),
      ...(input.calibration?.expansionWeighting !== undefined
        ? { expansionWeighting: input.calibration.expansionWeighting }
        : {}),
    });

    if (expansion.expansionApplied) {
      await emitRetrievalExpansionApplied(input.events, {
        traceId,
        workspaceId: input.query.workspaceId,
        extra: {
          neighbor_hints: expansion.contextualNeighbors.length,
          metadata_matches: expansion.metadataExpansion.matchedMetadataKeys.length,
          enrichment_score: expansion.metadataExpansion.enrichmentScore,
        },
      });

      contextPackage.retrievalMetadata = {
        ...contextPackage.retrievalMetadata,
        expansion,
      };
    }
  }

  return {
    traceId,
    contextPackage,
    stages,
    preprocessedQuery: preprocessed,
    ...(relationshipAugmentation ? { relationshipAugmentation } : {}),
    ...(input.executionContext ? { executionContext: input.executionContext } : {}),
  };
}

export { createOpenAiEmbeddingClient, mergeRetrievalConfig };
