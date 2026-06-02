import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  createOpenAiAbstractionClient,
  runCompressionPipeline,
} from "@memory-middleware/compression";
import {
  DEFAULT_COMPRESSION_FIDELITY,
  DEFAULT_NUANCE_PRESERVATION,
  DEFAULT_TOKEN_OPTIMIZATION,
  newUlid,
} from "@memory-middleware/shared-types";
import { loadEnv } from "../config/env.js";
import {
  completeCompressionOperation,
  createCompressionOperation,
  getCompressionTrace,
  getWorkspaceCompressionConfig,
  listCompressionTraces,
  parseCompressionBody,
  persistRelationships,
  resolveContextPackage,
  type StoredCompressionResult,
} from "../lib/compression-store.js";
import { getWorkspaceRelationshipGraph } from "../lib/relationship-graph-store.js";
import { captureReplaySnapshotFromTrace } from "../lib/historian-store.js";

export async function registerCompressionRoutes(app: FastifyInstance): Promise<void> {
  const env = loadEnv();

  app.post("/compress", async (request, reply) => {
    const parsed = parseCompressionBody(request.body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: parsed.error });
    }

    const workspace = await getWorkspaceCompressionConfig(app.prisma, parsed.workspaceId);
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const contextResult = await resolveContextPackage(app.prisma, parsed);
    if ("error" in contextResult) {
      return reply.status(400).send({ error: contextResult.error });
    }

    const fidelityMode =
      parsed.fidelityMode ??
      workspace.compression?.default_fidelity_mode ??
      DEFAULT_COMPRESSION_FIDELITY;
    const nuancePreservation =
      parsed.nuancePreservation ??
      workspace.compression?.default_nuance_preservation ??
      DEFAULT_NUANCE_PRESERVATION;
    const tokenOptimization =
      parsed.tokenOptimization ??
      workspace.compression?.default_token_optimization ??
      DEFAULT_TOKEN_OPTIMIZATION;

    const traceId = newUlid();
    const retrievalTraceId =
      parsed.retrievalTraceId ?? contextResult.retrievalTraceId;

    await createCompressionOperation(app.prisma, {
      workspaceId: parsed.workspaceId,
      traceId,
      retrievalTraceId,
      fidelityMode,
      nuancePreservation,
      tokenOptimization,
      ...(parsed.targetTokenBudget !== undefined
        ? { targetTokenBudget: parsed.targetTokenBudget }
        : {}),
    });

    const abstractionClient = env.OPENAI_API_KEY
      ? createOpenAiAbstractionClient(env.OPENAI_API_KEY)
      : null;

    const compressionRequest = {
      ...parsed,
      contextPackage: contextResult,
      fidelityMode,
      nuancePreservation,
      tokenOptimization,
    };

    try {
      const result = await runCompressionPipeline({
        request: compressionRequest,
        traceId,
        events: app.events,
        abstractionClient,
        runtimeOverrides: workspace.compression?.runtime,
        onStage: async (stages) => {
          const existing = await app.prisma.compressionOperation.findFirst({
            where: { traceId },
            orderBy: { createdAt: "desc" },
          });
          const prev = (existing?.result ?? {}) as unknown as StoredCompressionResult;
          const partial: StoredCompressionResult = {
            ...prev,
            retrievalTraceId,
            fidelityMode,
            nuancePreservation,
            tokenOptimization,
            ...(parsed.targetTokenBudget !== undefined
              ? { targetTokenBudget: parsed.targetTokenBudget }
              : {}),
            stages,
          };
          await app.prisma.compressionOperation.updateMany({
            where: { traceId },
            data: {
              result: JSON.parse(JSON.stringify(partial)) as Prisma.InputJsonValue,
            },
          });
        },
      });

      const stored: StoredCompressionResult = {
        retrievalTraceId,
        fidelityMode,
        nuancePreservation,
        tokenOptimization,
        ...(parsed.targetTokenBudget !== undefined
          ? { targetTokenBudget: parsed.targetTokenBudget }
          : {}),
        stages: result.stages,
        stageTraces: result.stageTraces,
        originalContextPackage: result.originalContextPackage,
        optimizedContextPackage: result.optimizedContextPackage,
        fidelityReport: result.fidelityReport,
        mergeDecisions: result.mergeDecisions,
        trimmingDecisions: result.trimmingDecisions,
        ...(result.error ? { error: result.error } : {}),
      };

      await completeCompressionOperation(
        app.prisma,
        traceId,
        stored,
        result.failed ? "failed" : "completed",
      );

      await captureReplaySnapshotFromTrace(app.prisma, retrievalTraceId);

      if (result.relationships.length > 0) {
        await persistRelationships(
          app.prisma,
          parsed.workspaceId,
          traceId,
          result.relationships,
        );
      }

      return {
        compressionTraceId: traceId,
        optimizedContextPackage: result.optimizedContextPackage,
        fidelityReport: result.fidelityReport,
        failed: result.failed,
        ...(result.error ? { error: result.error } : {}),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stored: StoredCompressionResult = {
        retrievalTraceId,
        fidelityMode,
        nuancePreservation,
        tokenOptimization,
        stages: [],
        stageTraces: [],
        originalContextPackage: contextResult,
        optimizedContextPackage: {
          ...contextResult,
          compressionTraceId: traceId,
          sourceRetrievalTraceId: contextResult.retrievalTraceId,
          compressionMetadata: {
            fidelityMode,
            nuancePreservation,
            tokenOptimization,
            originalTokens: contextResult.tokenBudget.usedTokens,
            optimizedTokens: contextResult.tokenBudget.usedTokens,
            tokenSavings: 0,
            fidelityScore: 1,
            abstractionUsed: false,
            preprocessingApplied: {
              queryHints: { retrievalHints: [], contextualWeights: {}, metadataTags: [] },
              metadataExpansion: {
                expandedTags: [],
                matchedMetadataKeys: [],
                enrichmentScore: 0,
              },
            },
            stages: [],
          },
        },
        fidelityReport: {
          fidelityScore: 1,
          nuancePreservationScore: 1,
          compressionAggressiveness: 0,
          retrievalQualityScore: 1,
          contextualPreservationScore: 1,
          validationPassed: true,
          issues: [`Compression failed — original context preserved: ${message}`],
          rankingPreservationRatio: 1,
          chunkRetentionRatio: 1,
        },
        error: message,
      };

      await completeCompressionOperation(app.prisma, traceId, stored, "failed");

      return reply.status(500).send({
        error: message,
        compressionTraceId: traceId,
        optimizedContextPackage: stored.optimizedContextPackage,
      });
    }
  });

  app.get<{ Querystring: { workspaceId?: string; limit?: string } }>(
    "/compression",
    async (request) => {
      const limit = Number(request.query.limit ?? 50);
      const traces = await listCompressionTraces(
        app.prisma,
        request.query.workspaceId,
        limit,
      );
      return { traces };
    },
  );

  app.get<{ Params: { traceId: string } }>(
    "/compression/:traceId",
    async (request, reply) => {
      const trace = await getCompressionTrace(app.prisma, request.params.traceId);
      if (!trace) {
        return reply.status(404).send({ error: "Compression trace not found" });
      }
      return { trace };
    },
  );

  app.get<{ Params: { traceId: string } }>(
    "/compression/:traceId/fidelity",
    async (request, reply) => {
      const trace = await getCompressionTrace(app.prisma, request.params.traceId);
      if (!trace) {
        return reply.status(404).send({ error: "Compression trace not found" });
      }

      return {
        compressionTraceId: trace.compressionTraceId,
        fidelityMode: trace.fidelityMode,
        nuancePreservation: trace.nuancePreservation,
        tokenOptimization: trace.tokenOptimization,
        fidelityReport: trace.fidelityReport,
        stageTraces: trace.stageTraces,
      };
    },
  );

  app.get<{ Querystring: { workspaceId?: string } }>(
    "/relationships/graph",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const graph = await getWorkspaceRelationshipGraph(app.prisma, workspaceId);
      if (!graph) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      return graph;
    },
  );
}
