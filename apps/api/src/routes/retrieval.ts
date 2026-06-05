import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import { createOpenAiEmbeddingClient } from "@memory-middleware/ingestion";
import { prepareContextPackageForDelivery } from "@memory-middleware/context-delivery";
import {
  mergeRetrievalConfig,
  runRetrievalPipeline,
  applyCalibrationToRetrievalConfig,
  retrieveObservations,
} from "@memory-middleware/retrieval";
import { mergeSystemCalibration } from "@memory-middleware/retrieval-diagnostics";
import {
  DOMAIN_ENGINE_EVENT_TYPES,
  newUlid,
  RELATIONSHIP_EVENT_TYPES,
} from "@memory-middleware/shared-types";
import { loadEnv } from "../config/env.js";
import { recordRetrievalForMemories } from "../lib/memory-evolution.js";
import {
  loadRelationshipsForMemories,
  reinforceCoOccurrenceRelationships,
} from "../lib/relationship-store.js";
import {
  buildAdjacencyLookupForChunks,
  loadMemoryMetadataForExpansion,
} from "../lib/retrieval-adjacency.js";
import { createPgVectorSearchStore } from "../lib/retrieval-vector-store.js";
import {
  buildRetrievalHeatmap,
  completeRetrievalOperation,
  createRetrievalOperation,
  getRetrievalTrace,
  getWorkspaceRetrievalConfig,
  getWorkspaceRetrievalRuntimeConfig,
  listRetrievalTraces,
  parseRetrievalBody,
  parseRetrievalConfigPatch,
  updateWorkspaceRetrievalConfig,
  type StoredRetrievalResult,
} from "../lib/retrieval-store.js";
import { captureReplaySnapshotFromTrace } from "../lib/historian-store.js";
import { getRetrievalPlan } from "../lib/planning-store.js";
import { createPrismaDomainEngineStore } from "../lib/domain-engine/index.js";
import { buildChunkMetadataLookup } from "../lib/domain-chunk-metadata.js";
import { loadMemoryMetadataByIds } from "../lib/domain-memory-metadata.js";
import { createObservationRetrievalStore } from "../lib/observation-retrieval-store.js";
import type { ObservationFilter } from "@memory-middleware/shared-types";
import {
  DomainEngineError,
  resolveDomainExecutionContext,
} from "@memory-middleware/domain-engine";

export async function registerRetrievalRoutes(app: FastifyInstance): Promise<void> {
  const env = loadEnv();

  app.get<{ Querystring: { workspaceId: string; limit?: string } }>(
    "/retrieval/heatmaps",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const limit = Number(request.query.limit ?? 100);
      const entries = await buildRetrievalHeatmap(
        app.prisma,
        request.query.workspaceId,
        limit,
      );

      return { workspaceId: request.query.workspaceId, entries };
    },
  );

  app.get<{ Querystring: { workspaceId: string } }>(
    "/retrieval/config",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const config = await getWorkspaceRetrievalRuntimeConfig(
        app.prisma,
        request.query.workspaceId,
      );
      if (!config) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      return config;
    },
  );

  app.patch("/retrieval/config", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }

    const parsed = parseRetrievalConfigPatch(body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: parsed.error });
    }

    const updated = await updateWorkspaceRetrievalConfig(app.prisma, workspaceId, parsed);
    if (!updated) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    return updated;
  });

  app.post("/retrieve", async (request, reply) => {
    const parsed = parseRetrievalBody(request.body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: parsed.error });
    }

    const workspace = await getWorkspaceRetrievalConfig(app.prisma, parsed.workspaceId);
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const traceId = newUlid();
    let config = mergeRetrievalConfig(workspace);

    const wsRow = await app.prisma.workspace.findUnique({ where: { id: parsed.workspaceId } });
    const wsConfigJson = (wsRow?.config ?? {}) as Record<string, unknown>;
    const storedCalibration = wsConfigJson.calibration as
      | import("@memory-middleware/shared-types").SystemCalibrationConfig
      | undefined;
    const calibration = mergeSystemCalibration(workspace, storedCalibration);
    config = applyCalibrationToRetrievalConfig(config, calibration, parsed.retrievalMode);

    await createRetrievalOperation(app.prisma, {
      workspaceId: parsed.workspaceId,
      traceId,
      query: parsed.query,
      retrievalMode: parsed.retrievalMode,
      tokenBudget: parsed.tokenBudget,
    });

    const embeddingClient = env.OPENAI_API_KEY
      ? createOpenAiEmbeddingClient(env.OPENAI_API_KEY)
      : null;

    const vectorStore = createPgVectorSearchStore(app.prisma);

    let executionContext: import("@memory-middleware/shared-types").DomainExecutionContext | undefined;
    if (parsed.domainKey) {
      const domainStore = createPrismaDomainEngineStore(app.prisma);
      try {
        executionContext = await resolveDomainExecutionContext(
          { store: domainStore, events: app.events, traceId },
          {
            workspaceId: parsed.workspaceId,
            domainKey: parsed.domainKey,
            ...(parsed.domainAction ? { domainAction: parsed.domainAction } : {}),
          },
        );
      } catch (error) {
        if (error instanceof DomainEngineError) {
          const status = error.code === "instruction_not_found" ? 404 : 404;
          return reply.status(status).send({
            error: error.message,
            code: error.code,
            ...(error.details ? { details: error.details } : {}),
          });
        }
        throw error;
      }
    }

    let retrievalPlan;
    if (parsed.planId) {
      const storedPlan = await getRetrievalPlan(app.prisma, parsed.planId);
      if (!storedPlan) {
        return reply.status(404).send({ error: "Retrieval plan not found" });
      }
      if (storedPlan.plan.workspaceId !== parsed.workspaceId) {
        return reply.status(400).send({ error: "Retrieval plan does not belong to this workspace" });
      }
      retrievalPlan = storedPlan.plan;
    }

    try {
      const result = await runRetrievalPipeline({
        query: parsed,
        traceId,
        config,
        vectorStore,
        embeddingClient,
        events: app.events,
        calibration: calibration.retrieval,
        ...(executionContext ? { executionContext } : {}),
        ...(retrievalPlan ? { retrievalPlan } : {}),
        loadTargetMemoryMetadata: (memoryIds) =>
          loadMemoryMetadataByIds(app.prisma, memoryIds),
        loadAdjacencyForChunks: (chunkIds) =>
          buildAdjacencyLookupForChunks(app.prisma, chunkIds),
        loadMemoryMetadata: (memoryIds) =>
          loadMemoryMetadataForExpansion(app.prisma, memoryIds),
        loadRelationshipsForMemories: async (memoryIds) => {
          const rels = await loadRelationshipsForMemories(
            app.prisma,
            parsed.workspaceId,
            memoryIds,
          );
          return rels.map((r) => ({
            sourceMemoryId: r.sourceMemoryId,
            targetMemoryId: r.targetMemoryId,
            relationshipType: r.relationshipType,
            confidence: r.confidence,
            weight: r.weight,
            generatedFrom: r.generatedFrom,
          }));
        },
        onStage: async (stages) => {
          const existing = await app.prisma.retrievalOperation.findFirst({
            where: { traceId },
            orderBy: { createdAt: "desc" },
          });
          const prev = (existing?.result ?? {}) as unknown as StoredRetrievalResult;
          const partial: StoredRetrievalResult = {
            ...prev,
            retrievalMode: parsed.retrievalMode,
            tokenBudget: parsed.tokenBudget,
            stages,
          };
          await app.prisma.retrievalOperation.updateMany({
            where: { traceId },
            data: {
              result: JSON.parse(JSON.stringify(partial)) as Prisma.InputJsonValue,
            },
          });
        },
      });

      let contextPackage = result.contextPackage;
      let observations: import("@memory-middleware/shared-types").NormalizedObservation[] | undefined;

      if (executionContext && executionContext.observationFilters.length > 0) {
        const mergedFilters: ObservationFilter[] = [
          ...executionContext.observationFilters,
          ...(parsed.observationFilters ?? []),
        ];
        observations = await retrieveObservations(createObservationRetrievalStore(app.prisma), {
          workspaceId: parsed.workspaceId,
          filters: mergedFilters,
        });
        contextPackage = {
          ...contextPackage,
          observations,
        };
      }

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
            trace_id: traceId,
            workspace_id: parsed.workspaceId,
            metadata: {
              override_count: prepared.domainMetadata.factOverrides.length,
              domain_key: result.executionContext.domainKey,
            },
          });
        }
      }

      const stored: StoredRetrievalResult = {
        contextPackage,
        stages: result.stages,
        preprocessedQuery: result.preprocessedQuery,
        retrievalMode: parsed.retrievalMode,
        tokenBudget: parsed.tokenBudget,
        ...(result.relationshipAugmentation
          ? { relationshipAugmentation: result.relationshipAugmentation }
          : {}),
        ...(result.executionContext ? { executionContext: result.executionContext } : {}),
      };

      await completeRetrievalOperation(app.prisma, traceId, stored, "completed");

      if (result.relationshipAugmentation?.augmentationApplied) {
        await app.events.emit({
          event_type: RELATIONSHIP_EVENT_TYPES.AUGMENTATION_APPLIED,
          trace_id: traceId,
          workspace_id: parsed.workspaceId,
          metadata: {
            neighbor_count: result.relationshipAugmentation.neighborCount,
            ranking_impacts: result.relationshipAugmentation.rankingImpacts.length,
          },
        });
      }

      await captureReplaySnapshotFromTrace(app.prisma, traceId);

      const retrievedMemoryIds = contextPackage.memories.map((m) => m.memoryId);
      await recordRetrievalForMemories(
        app.prisma,
        app.events,
        retrievedMemoryIds,
        traceId,
        parsed.workspaceId,
      );

      await reinforceCoOccurrenceRelationships(
        app.prisma,
        parsed.workspaceId,
        retrievedMemoryIds,
      );

      return {
        retrievalTraceId: traceId,
        contextPackage,
        ...(observations ? { observations } : {}),
        ...(contextPackage.domainMetadata
          ? { factOverrides: contextPackage.domainMetadata.factOverrides }
          : {}),
        ...(result.executionContext ? { executionContext: result.executionContext } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await completeRetrievalOperation(
        app.prisma,
        traceId,
        {
          contextPackage: {
            query: parsed.query,
            workspaceId: parsed.workspaceId,
            retrievalTraceId: traceId,
            tokenBudget: {
              maxTokens: parsed.tokenBudget,
              usedTokens: 0,
              trimmedTokens: 0,
            },
            retrievalMetadata: {
              retrievalLatencyMs: 0,
              retrievedChunkCount: 0,
              deduplicatedChunkCount: 0,
              finalChunkCount: 0,
            },
            memories: [],
            rejectedCandidates: [],
            rankingBreakdown: [],
            chunkTraces: [],
            generatedAt: new Date().toISOString(),
          },
          stages: [],
          preprocessedQuery: {
            normalizedQuery: parsed.query,
            keywords: [],
            tokenCount: 0,
          },
          retrievalMode: parsed.retrievalMode,
          tokenBudget: parsed.tokenBudget,
        },
        "failed",
        message,
      );

      return reply.status(500).send({
        error: message,
        retrievalTraceId: traceId,
      });
    }
  });

  app.get<{ Querystring: { workspaceId?: string; limit?: string } }>(
    "/retrieval",
    async (request) => {
      const limit = Number(request.query.limit ?? 50);
      const traces = await listRetrievalTraces(
        app.prisma,
        request.query.workspaceId,
        limit,
      );
      return { traces };
    },
  );

  app.get<{ Params: { traceId: string } }>("/retrieval/:traceId", async (request, reply) => {
    const trace = await getRetrievalTrace(app.prisma, request.params.traceId);
    if (!trace) {
      return reply.status(404).send({ error: "Retrieval trace not found" });
    }
    return { trace };
  });

  app.get<{ Params: { traceId: string } }>(
    "/retrieval/:traceId/ranking",
    async (request, reply) => {
      const trace = await getRetrievalTrace(app.prisma, request.params.traceId);
      if (!trace) {
        return reply.status(404).send({ error: "Retrieval trace not found" });
      }

      return {
        retrievalTraceId: trace.retrievalTraceId,
        rankingBreakdown: trace.contextPackage?.rankingBreakdown ?? [],
        chunkTraces: trace.contextPackage?.chunkTraces ?? [],
      };
    },
  );

  app.get<{ Params: { traceId: string } }>(
    "/retrieval/:traceId/rejections",
    async (request, reply) => {
      const trace = await getRetrievalTrace(app.prisma, request.params.traceId);
      if (!trace) {
        return reply.status(404).send({ error: "Retrieval trace not found" });
      }

      return {
        retrievalTraceId: trace.retrievalTraceId,
        rejectedCandidates: trace.contextPackage?.rejectedCandidates ?? [],
      };
    },
  );

}
