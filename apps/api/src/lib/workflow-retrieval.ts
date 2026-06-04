import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { createOpenAiEmbeddingClient } from "@memory-middleware/ingestion";
import { prepareContextPackageForDelivery } from "@memory-middleware/context-delivery";
import {
  mergeRetrievalConfig,
  runRetrievalPipeline,
  applyCalibrationToRetrievalConfig,
} from "@memory-middleware/retrieval";
import { mergeSystemCalibration } from "@memory-middleware/retrieval-diagnostics";
import type { ContextPackage } from "@memory-middleware/shared-types";
import { DOMAIN_ENGINE_EVENT_TYPES } from "@memory-middleware/shared-types";
import { loadEnv } from "../config/env.js";
import { buildChunkMetadataLookup } from "./domain-chunk-metadata.js";
import { loadMemoryMetadataByIds } from "./domain-memory-metadata.js";
import { createPrismaDomainEngineStore } from "./domain-engine/index.js";
import {
  buildAdjacencyLookupForChunks,
  loadMemoryMetadataForExpansion,
} from "./retrieval-adjacency.js";
import { createPgVectorSearchStore } from "./retrieval-vector-store.js";
import {
  completeRetrievalOperation,
  createRetrievalOperation,
  getWorkspaceRetrievalConfig,
  type StoredRetrievalResult,
} from "./retrieval-store.js";
import { loadRelationshipsForMemories } from "./relationship-store.js";
import {
  DomainEngineError,
  resolveDomainExecutionContext,
  type WorkflowRetrievalInput,
} from "@memory-middleware/domain-engine";

export async function retrieveForWorkflowDomain(
  app: FastifyInstance,
  input: WorkflowRetrievalInput,
): Promise<ContextPackage> {
  const env = loadEnv();
  const workspace = await getWorkspaceRetrievalConfig(app.prisma, input.workspaceId);
  if (!workspace) {
    throw new DomainEngineError("Workspace not found", "not_found");
  }

  let config = mergeRetrievalConfig(workspace);
  const wsRow = await app.prisma.workspace.findUnique({ where: { id: input.workspaceId } });
  const wsConfigJson = (wsRow?.config ?? {}) as Record<string, unknown>;
  const storedCalibration = wsConfigJson.calibration as
    | import("@memory-middleware/shared-types").SystemCalibrationConfig
    | undefined;
  const calibration = mergeSystemCalibration(workspace, storedCalibration);
  config = applyCalibrationToRetrievalConfig(config, calibration, "precision");

  await createRetrievalOperation(app.prisma, {
    workspaceId: input.workspaceId,
    traceId: input.traceId,
    query: input.query,
    retrievalMode: "precision",
    tokenBudget: input.tokenBudget,
  });

  const domainStore = createPrismaDomainEngineStore(app.prisma);
  const executionContext = await resolveDomainExecutionContext(
    { store: domainStore, events: app.events, traceId: input.traceId },
    {
      workspaceId: input.workspaceId,
      domainKey: input.domainKey,
      ...(input.domainAction ? { domainAction: input.domainAction } : {}),
    },
  );

  const embeddingClient = env.OPENAI_API_KEY
    ? createOpenAiEmbeddingClient(env.OPENAI_API_KEY)
    : null;
  const vectorStore = createPgVectorSearchStore(app.prisma);

  const result = await runRetrievalPipeline({
    query: {
      workspaceId: input.workspaceId,
      query: input.query,
      tokenBudget: input.tokenBudget,
      retrievalMode: "precision",
      domainKey: input.domainKey,
      ...(input.domainAction ? { domainAction: input.domainAction } : {}),
    },
    traceId: input.traceId,
    config,
    vectorStore,
    embeddingClient,
    events: app.events,
    calibration: calibration.retrieval,
    executionContext,
    loadTargetMemoryMetadata: (memoryIds) => loadMemoryMetadataByIds(app.prisma, memoryIds),
    loadAdjacencyForChunks: (chunkIds) => buildAdjacencyLookupForChunks(app.prisma, chunkIds),
    loadMemoryMetadata: (memoryIds) => loadMemoryMetadataForExpansion(app.prisma, memoryIds),
    loadRelationshipsForMemories: async (memoryIds) => {
      const rels = await loadRelationshipsForMemories(app.prisma, input.workspaceId, memoryIds);
      return rels.map((rel) => ({
        sourceMemoryId: rel.sourceMemoryId,
        targetMemoryId: rel.targetMemoryId,
        relationshipType: rel.relationshipType,
        confidence: rel.confidence,
        weight: rel.weight,
        generatedFrom: rel.generatedFrom,
      }));
    },
  });

  let contextPackage = result.contextPackage;
  if (result.executionContext) {
    const metadataByChunkId = await buildChunkMetadataLookup(app.prisma, contextPackage);
    const prepared = prepareContextPackageForDelivery({
      contextPackage,
      executionContext: result.executionContext,
      metadataByChunkId,
    });
    contextPackage = prepared.contextPackage;

    if (prepared.domainMetadata.factOverrides.length > 0) {
      await app.events.emit({
        event_type: DOMAIN_ENGINE_EVENT_TYPES.FACT_OVERRIDE_APPLIED,
        trace_id: input.traceId,
        workspace_id: input.workspaceId,
        metadata: {
          override_count: prepared.domainMetadata.factOverrides.length,
          domain_key: result.executionContext.domainKey,
          workflow_domain_retrieval: true,
        },
      });
    }
  }

  const stored: StoredRetrievalResult = {
    contextPackage,
    stages: result.stages,
    preprocessedQuery: result.preprocessedQuery,
    retrievalMode: "precision",
    tokenBudget: input.tokenBudget,
    ...(result.executionContext ? { executionContext: result.executionContext } : {}),
  };

  await completeRetrievalOperation(app.prisma, input.traceId, stored, "completed");
  return contextPackage;
}
