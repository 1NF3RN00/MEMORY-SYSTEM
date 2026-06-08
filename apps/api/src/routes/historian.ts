import type { FastifyInstance } from "fastify";
import { runWithLlmCallAsync } from "@memory-middleware/observability";
import { createOpenAiAbstractionClient, runCompressionPipeline } from "@memory-middleware/compression";
import { createOpenAiEmbeddingClient } from "@memory-middleware/ingestion";
import {
  buildBenchmarkComparison,
  buildTokenInflationReport,
  detectDrift,
  emitBenchmarkExecuted,
  emitDriftDetected,
  emitPermanentDeletionExecuted,
  emitReplayCompleted,
  emitReplayStarted,
  emitRetentionArchived,
} from "@memory-middleware/historian";
import { mergeRetrievalConfig, runRetrievalPipeline } from "@memory-middleware/retrieval";
import type { BenchmarkReplayRequest, ReplayMode, ReplayStageName } from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";
import { loadEnv } from "../config/env.js";
import {
  DEFAULT_COMPRESSION_FIDELITY,
  DEFAULT_NUANCE_PRESERVATION,
  DEFAULT_TOKEN_OPTIMIZATION,
} from "@memory-middleware/shared-types";
import {
  completeCompressionOperation,
  createCompressionOperation,
  getWorkspaceCompressionConfig,
  type StoredCompressionResult,
} from "../lib/compression-store.js";
import {
  applyRetentionArchival,
  buildMemoryHistoryTimeline,
  captureReplaySnapshotFromTrace,
  getReplaySnapshotByTraceId,
  listReplaySnapshots,
  permanentlyDeleteHistory,
  runStoredReplay,
} from "../lib/historian-store.js";
import {
  buildFullOperationalDiagnosticsReport,
  buildSlimOperationalDiagnosticsReport,
  enrichTracesForOperationalDiagnostics,
} from "../lib/operational-diagnostics.js";
import {
  buildAdjacencyLookupForChunks,
  loadMemoryMetadataForExpansion,
} from "../lib/retrieval-adjacency.js";
import { createPgVectorSearchStore } from "../lib/retrieval-vector-store.js";
import {
  completeRetrievalOperation,
  createRetrievalOperation,
  getRetrievalFailureInfoByTraceIds,
  getRetrievalResultsByTraceIds,
  getWorkspaceRetrievalConfig,
  listRetrievalTraces,
  type StoredRetrievalResult,
} from "../lib/retrieval-store.js";

export async function registerHistorianRoutes(app: FastifyInstance): Promise<void> {
  const env = loadEnv();

  app.get<{
    Params: { traceId: string };
    Querystring: { mode?: ReplayMode; stage?: ReplayStageName };
  }>("/replay/:traceId", async (request, reply) => {
    const replayTraceId = newUlid();
    const mode = request.query.mode ?? "exact";
    const stage = request.query.stage;

    const snapshot = await getReplaySnapshotByTraceId(app.prisma, request.params.traceId);
    if (!snapshot) {
      return reply.status(404).send({ error: "Replay snapshot not found for trace" });
    }

    await emitReplayStarted(
      app.events,
      replayTraceId,
      snapshot.workspaceId,
      request.params.traceId,
      mode,
    );

    const replay = await runStoredReplay(
      app.prisma,
      request.params.traceId,
      mode,
      stage,
    );

    if (!replay) {
      return reply.status(404).send({ error: "Replay execution failed" });
    }

    await emitReplayCompleted(
      app.events,
      replayTraceId,
      snapshot.workspaceId,
      replay.replayId,
      replay.integrityValid,
    );

    return { replay };
  });

  app.post("/replay/benchmark", async (request, reply) => {
    return runWithLlmCallAsync(request.llmCallCollector, async () => {
    const body = request.body as BenchmarkReplayRequest | undefined;
    if (!body?.workspaceId || !body?.retrievalTraceId) {
      return reply.status(400).send({ error: "workspaceId and retrievalTraceId are required" });
    }

    const originalSnapshot = await getReplaySnapshotByTraceId(
      app.prisma,
      body.retrievalTraceId,
    );
    if (!originalSnapshot) {
      return reply.status(404).send({ error: "Original replay snapshot not found" });
    }

    if (originalSnapshot.workspaceId !== body.workspaceId) {
      return reply.status(400).send({ error: "Workspace mismatch" });
    }

    const benchmarkTraceId = newUlid();
    let benchmarkContextPackage = originalSnapshot.contextPackage;
    let benchmarkOptimizedPackage = originalSnapshot.compressionArtifacts[0]?.optimizedContextPackage;

    if (body.rerunRetrieval) {
      const workspace = await getWorkspaceRetrievalConfig(app.prisma, body.workspaceId);
      if (!workspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      const config = mergeRetrievalConfig(workspace);
      const embeddingClient = env.OPENAI_API_KEY
        ? createOpenAiEmbeddingClient(env.OPENAI_API_KEY)
        : null;
      const vectorStore = createPgVectorSearchStore(app.prisma);

      await createRetrievalOperation(app.prisma, {
        workspaceId: body.workspaceId,
        traceId: benchmarkTraceId,
        query: originalSnapshot.originalQuery,
        retrievalMode: originalSnapshot.retrievalMode,
        tokenBudget: originalSnapshot.tokenBudget,
      });

      try {
        const result = await runRetrievalPipeline({
          query: {
            workspaceId: body.workspaceId,
            query: originalSnapshot.originalQuery,
            tokenBudget: originalSnapshot.tokenBudget,
            retrievalMode: originalSnapshot.retrievalMode,
          },
          traceId: benchmarkTraceId,
          config,
          vectorStore,
          embeddingClient,
          events: app.events,
          loadAdjacencyForChunks: (chunkIds) =>
            buildAdjacencyLookupForChunks(app.prisma, chunkIds),
          loadMemoryMetadata: (memoryIds) =>
            loadMemoryMetadataForExpansion(app.prisma, memoryIds),
        });

        benchmarkContextPackage = result.contextPackage;

        await completeRetrievalOperation(
          app.prisma,
          benchmarkTraceId,
          {
            contextPackage: result.contextPackage,
            stages: result.stages,
            preprocessedQuery: result.preprocessedQuery,
            retrievalMode: originalSnapshot.retrievalMode,
            tokenBudget: originalSnapshot.tokenBudget,
          },
          "completed",
        );

        await captureReplaySnapshotFromTrace(app.prisma, benchmarkTraceId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return reply.status(500).send({ error: message, benchmarkTraceId });
      }
    }

    if (body.rerunCompression) {
      const workspace = await getWorkspaceCompressionConfig(app.prisma, body.workspaceId);
      if (!workspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      const compressionTraceId = newUlid();
      const fidelityMode =
        (body.compressionOverrides?.fidelityMode as typeof DEFAULT_COMPRESSION_FIDELITY) ??
        workspace.compression?.default_fidelity_mode ??
        DEFAULT_COMPRESSION_FIDELITY;
      const nuancePreservation =
        body.compressionOverrides?.nuancePreservation ??
        workspace.compression?.default_nuance_preservation ??
        DEFAULT_NUANCE_PRESERVATION;
      const tokenOptimization =
        body.compressionOverrides?.tokenOptimization ??
        workspace.compression?.default_token_optimization ??
        DEFAULT_TOKEN_OPTIMIZATION;

      await createCompressionOperation(app.prisma, {
        workspaceId: body.workspaceId,
        traceId: compressionTraceId,
        retrievalTraceId: body.rerunRetrieval ? benchmarkTraceId : body.retrievalTraceId,
        fidelityMode,
        nuancePreservation,
        tokenOptimization,
        ...(body.compressionOverrides?.targetTokenBudget !== undefined
          ? { targetTokenBudget: body.compressionOverrides.targetTokenBudget }
          : {}),
      });

      const abstractionClient = env.OPENAI_API_KEY
        ? createOpenAiAbstractionClient(env.OPENAI_API_KEY)
        : null;

      const compressionResult = await runCompressionPipeline({
        request: {
          workspaceId: body.workspaceId,
          contextPackage: benchmarkContextPackage,
          fidelityMode,
          nuancePreservation,
          tokenOptimization,
          ...(body.compressionOverrides?.targetTokenBudget !== undefined
            ? { targetTokenBudget: body.compressionOverrides.targetTokenBudget }
            : {}),
        },
        traceId: compressionTraceId,
        events: app.events,
        abstractionClient,
        runtimeOverrides: workspace.compression?.runtime,
      });

      benchmarkOptimizedPackage = compressionResult.optimizedContextPackage;

      const stored: StoredCompressionResult = {
        retrievalTraceId: body.rerunRetrieval ? benchmarkTraceId : body.retrievalTraceId,
        fidelityMode,
        nuancePreservation,
        tokenOptimization,
        stages: compressionResult.stages,
        stageTraces: compressionResult.stageTraces,
        originalContextPackage: compressionResult.originalContextPackage,
        optimizedContextPackage: compressionResult.optimizedContextPackage,
        fidelityReport: compressionResult.fidelityReport,
        mergeDecisions: compressionResult.mergeDecisions,
        trimmingDecisions: compressionResult.trimmingDecisions,
      };

      await completeCompressionOperation(
        app.prisma,
        compressionTraceId,
        stored,
        compressionResult.failed ? "failed" : "completed",
      );
    }

    const comparison = buildBenchmarkComparison({
      originalSnapshot,
      benchmarkContextPackage,
      ...(benchmarkOptimizedPackage ? { benchmarkOptimizedPackage } : {}),
    });

    await emitBenchmarkExecuted(
      app.events,
      comparison.benchmarkId,
      body.workspaceId,
      comparison.benchmarkId,
      body.retrievalTraceId,
    );

    return { comparison, ...(body.rerunRetrieval ? { benchmarkTraceId } : {}) };
    });
  });

  app.get<{ Querystring: { workspaceId?: string; limit?: string } }>(
    "/diagnostics/drift",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const limit = Number(request.query.limit ?? 50);
      const snapshots = await listReplaySnapshots(app.prisma, request.query.workspaceId, limit);
      const report = detectDrift({
        workspaceId: request.query.workspaceId,
        snapshots,
      });

      await emitDriftDetected(
        app.events,
        newUlid(),
        request.query.workspaceId,
        report.signals.length,
      );

      return { report };
    },
  );

  app.get<{ Querystring: { workspaceId?: string; limit?: string } }>(
    "/diagnostics/token-inflation",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const limit = Number(request.query.limit ?? 50);
      const snapshots = await listReplaySnapshots(app.prisma, request.query.workspaceId, limit);
      const report = buildTokenInflationReport(request.query.workspaceId, snapshots);
      return { report };
    },
  );

  app.get<{ Querystring: { workspaceId?: string; limit?: string; mode?: string } }>(
    "/diagnostics/operational",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const limit = Number(request.query.limit ?? 100);
      const mode = request.query.mode === "slim" ? "slim" : "full";
      const traces = await listRetrievalTraces(app.prisma, request.query.workspaceId, limit);
      const snapshots = await listReplaySnapshots(app.prisma, request.query.workspaceId, limit);
      const snapshotByTrace = new Map(snapshots.map((s) => [s.retrievalTraceId, s]));

      const failedTraceIds = traces
        .filter((t) => t.status === "failed")
        .map((t) => t.retrievalTraceId);

      const resultsByTraceId =
        mode === "slim"
          ? await getRetrievalFailureInfoByTraceIds(app.prisma, failedTraceIds)
          : await getRetrievalResultsByTraceIds(
              app.prisma,
              traces.map((t) => t.retrievalTraceId),
            );

      const enrichedTraces = enrichTracesForOperationalDiagnostics(
        traces,
        resultsByTraceId as Map<string, StoredRetrievalResult>,
        snapshotByTrace,
      );

      if (mode === "slim") {
        const report = buildSlimOperationalDiagnosticsReport(
          request.query.workspaceId,
          enrichedTraces,
        );
        return { report };
      }

      const report = buildFullOperationalDiagnosticsReport(
        request.query.workspaceId,
        enrichedTraces,
      );

      return { report };
    },
  );

  app.get<{ Params: { memoryId: string } }>("/history/:memoryId", async (request, reply) => {
    const timeline = await buildMemoryHistoryTimeline(app.prisma, request.params.memoryId);
    if ("error" in timeline) {
      return reply.status(timeline.status).send({ error: timeline.error });
    }
    return { timeline };
  });

  app.delete<{ Params: { id: string } }>(
    "/history/:id/permanent",
    async (request, reply) => {
      const result = await permanentlyDeleteHistory(app.prisma, request.params.id);
      if ("error" in result) {
        return reply.status(result.status).send({ error: result.error });
      }

      await emitPermanentDeletionExecuted(
        app.events,
        newUlid(),
        result.workspaceId,
        result.deletedId,
        {
          removed_replay_snapshots: result.removedReplaySnapshots,
          removed_retrieval_operations: result.removedRetrievalOperations,
          removed_compression_operations: result.removedCompressionOperations,
          removed_event_logs: result.removedEventLogs,
        },
      );

      return { result };
    },
  );

  app.post<{ Querystring: { workspaceId?: string } }>(
    "/historian/retention/archive",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const result = await applyRetentionArchival(app.prisma, request.query.workspaceId);

      if (result.archivedCount > 0) {
        await emitRetentionArchived(
          app.events,
          newUlid(),
          request.query.workspaceId,
          result.archivedCount,
          result.retentionMode,
        );
      }

      return { result };
    },
  );

  app.get<{ Querystring: { workspaceId?: string; limit?: string } }>(
    "/historian/snapshots",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const limit = Number(request.query.limit ?? 50);
      const snapshots = await listReplaySnapshots(app.prisma, request.query.workspaceId, limit);
      return { snapshots };
    },
  );
}
