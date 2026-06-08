import type { FastifyInstance } from "fastify";
import { getDbOperationLeaderboard, runWithLlmCallAsync } from "@memory-middleware/observability";
import { createOpenAiAbstractionClient, runCompressionPipeline } from "@memory-middleware/compression";
import { runContextRenderPipeline } from "@memory-middleware/context-delivery";
import { createOpenAiEmbeddingClient } from "@memory-middleware/ingestion";
import { buildBenchmarkComparison } from "@memory-middleware/historian";
import { applyCalibrationToRetrievalConfig, mergeRetrievalConfig, runRetrievalPipeline } from "@memory-middleware/retrieval";
import {
  analyzeCandidateRejection,
  analyzeMetadataExpansion,
  analyzeRetrievalBreadth,
  buildFullTraceAnalysis,
  buildRetrievalSystemReport,
  buildSignalQualityView,
  buildWorkspaceDiagnosticsSummary,
  computeMetricDeltas,
  computeRetrievalQualityMetrics,
  createWorkspaceBenchmarkSet,
  emitCalibrationBenchmarkExecuted,
  emitCalibrationChanged,
  emitDiagnosticsReportGenerated,
  emitTraceAnalysisCompleted,
  evaluateBenchmarkSet,
  mergeSystemCalibration,
} from "@memory-middleware/retrieval-diagnostics";
import type {
  CalibrationBenchmarkRequest,
  CalibrationPatchRequest,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_COMPRESSION_FIDELITY,
  DEFAULT_NUANCE_PRESERVATION,
  DEFAULT_TOKEN_OPTIMIZATION,
  newUlid,
} from "@memory-middleware/shared-types";
import { loadEnv } from "../config/env.js";
import { loadDbObservabilityEnv } from "../config/db-observability-env.js";
import { queryDbOperationHistoryFromEventLog } from "../lib/db-operation-history.js";
import {
  buildReportInputFromTrace,
  getCalibrationView,
  patchCalibration,
} from "../lib/calibration-store.js";
import {
  completeCompressionOperation,
  createCompressionOperation,
  getWorkspaceCompressionConfig,
  type StoredCompressionResult,
} from "../lib/compression-store.js";
import { completeContextRenderOperation, createContextRenderOperation, type StoredContextRenderResult } from "../lib/context-store.js";
import {
  captureReplaySnapshotFromTrace,
  getReplaySnapshotByTraceId,
  listReplaySnapshots,
} from "../lib/historian-store.js";
import {
  buildAdjacencyLookupForChunks,
  loadMemoryMetadataForExpansion,
} from "../lib/retrieval-adjacency.js";
import { createPgVectorSearchStore } from "../lib/retrieval-vector-store.js";
import {
  completeRetrievalOperation,
  createRetrievalOperation,
  getWorkspaceRetrievalConfig,
  listRetrievalTraces,
  type StoredRetrievalResult,
} from "../lib/retrieval-store.js";

export async function registerDiagnosticsRoutes(app: FastifyInstance): Promise<void> {
  const env = loadEnv();
  const dbEnv = loadDbObservabilityEnv();

  app.get<{
    Querystring: { limit?: string; scopeType?: string; source?: string; offset?: string };
  }>("/diagnostics/db-operations", async (request, reply) => {
    const parsedLimit = Number(request.query.limit ?? 20);
    const limit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(1, Math.trunc(parsedLimit)), 100)
      : 20;
    const parsedOffset = Number(request.query.offset ?? 0);
    const offset = Number.isFinite(parsedOffset) ? Math.max(0, Math.trunc(parsedOffset)) : 0;
    const scopeType = request.query.scopeType?.trim();
    const source = request.query.source?.trim().toLowerCase() ?? "memory";

    if (source !== "memory" && source !== "history") {
      return reply.status(400).send({
        error: "Invalid source query parameter; use memory or history",
      });
    }

    if (source === "history") {
      const history = await queryDbOperationHistoryFromEventLog(app.prisma, {
        limit,
        offset,
        windowSize: dbEnv.DB_LEADERBOARD_HISTORY_WINDOW,
        ...(scopeType ? { scopeType } : {}),
      });

      return {
        generatedAt: new Date().toISOString(),
        source: "history",
        entries: history.entries,
        pagination: {
          limit,
          offset,
          windowSize: history.windowSize,
          scannedCount: history.scannedCount,
        },
        limitations: {
          boundedWindow: true,
          coldStartSurvives: true,
          description:
            "Historical leaderboard from EventLog database.scope.completed events within the most recent window. Uses an index-backed fetch on eventType + timestamp (bounded take), then sorts by totalDbTime in-process. Does not scan the full EventLog table.",
          comparison: {
            memory:
              "Default in-memory source: live process ring buffer, resets on cold start, reflects scopes since boot only.",
            history:
              "EventLog history source: survives restarts, bounded to recent window, may omit older high-DB-time scopes outside the window.",
          },
        },
      };
    }

    const leaderboard = getDbOperationLeaderboard(dbEnv.DB_LEADERBOARD_SIZE);
    const entries = leaderboard.getTop(limit, scopeType || undefined);

    return {
      generatedAt: new Date().toISOString(),
      source: "memory",
      entries,
      limitations: {
        inMemoryOnly: true,
        coldStartClears: true,
        description:
          "Leaderboard is held in process memory and resets on cold start or deploy. Use ?source=history for cross-restart EventLog-backed history.",
        comparison: {
          memory:
            "Default in-memory source: live process ring buffer, resets on cold start, reflects scopes since boot only.",
          history:
            "EventLog history source: survives restarts via GET /diagnostics/db-operations?source=history.",
        },
      },
    };
  });

  app.get<{ Params: { traceId: string } }>(
    "/diagnostics/report/:traceId",
    async (request, reply) => {
      const snapshot = await getReplaySnapshotByTraceId(app.prisma, request.params.traceId);
      if (!snapshot) {
        return reply.status(404).send({ error: "Replay snapshot not found for trace" });
      }

      const input = await buildReportInputFromTrace(
        app.prisma,
        request.params.traceId,
        snapshot,
      );
      const report = buildRetrievalSystemReport(input);

      await emitDiagnosticsReportGenerated(
        app.events,
        newUlid(),
        snapshot.workspaceId,
        report.reportId,
        report.retrievalTraceId,
        report.detectedProblems.length,
      );

      return { report };
    },
  );

  app.get<{ Params: { traceId: string } }>(
    "/diagnostics/trace/:traceId",
    async (request, reply) => {
      const snapshot = await getReplaySnapshotByTraceId(app.prisma, request.params.traceId);
      if (!snapshot) {
        return reply.status(404).send({ error: "Replay snapshot not found for trace" });
      }

      const input = await buildReportInputFromTrace(
        app.prisma,
        request.params.traceId,
        snapshot,
      );
      const analysis = buildFullTraceAnalysis(input);
      const signalQuality = buildSignalQualityView(input);
      const breadthAnalysis = analyzeRetrievalBreadth(input);
      const rejectionAnalysis = analyzeCandidateRejection(input);
      const expansionAnalysis = analyzeMetadataExpansion(input);

      await emitTraceAnalysisCompleted(
        app.events,
        newUlid(),
        snapshot.workspaceId,
        request.params.traceId,
        analysis.stages.length,
      );

      return {
        analysis,
        signalQuality,
        breadthAnalysis,
        rejectionAnalysis,
        expansionAnalysis,
      };
    },
  );

  app.get<{ Params: { traceId: string } }>(
    "/diagnostics/breadth/:traceId",
    async (request, reply) => {
      const snapshot = await getReplaySnapshotByTraceId(app.prisma, request.params.traceId);
      if (!snapshot) {
        return reply.status(404).send({ error: "Replay snapshot not found for trace" });
      }

      const input = await buildReportInputFromTrace(
        app.prisma,
        request.params.traceId,
        snapshot,
      );

      return {
        breadthAnalysis: analyzeRetrievalBreadth(input),
        rejectionAnalysis: analyzeCandidateRejection(input),
        expansionAnalysis: analyzeMetadataExpansion(input),
      };
    },
  );

  app.get<{ Querystring: { workspaceId?: string } }>(
    "/diagnostics/benchmark-set",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      return { benchmarkSet: createWorkspaceBenchmarkSet(request.query.workspaceId) };
    },
  );

  app.get<{ Querystring: { workspaceId?: string; limit?: string } }>(
    "/diagnostics/workspace",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const limit = Number(request.query.limit ?? 30);
      const traces = await listRetrievalTraces(app.prisma, request.query.workspaceId, limit);
      const snapshots = await listReplaySnapshots(app.prisma, request.query.workspaceId, limit);
      const snapshotByTrace = new Map(snapshots.map((s) => [s.retrievalTraceId, s]));

      const reports = [];
      for (const trace of traces) {
        if (trace.status !== "completed") continue;
        const snapshot = snapshotByTrace.get(trace.retrievalTraceId);
        if (!snapshot) continue;
        const input = await buildReportInputFromTrace(
          app.prisma,
          trace.retrievalTraceId,
          snapshot,
        );
        reports.push(buildRetrievalSystemReport(input));
      }

      const summary = buildWorkspaceDiagnosticsSummary(request.query.workspaceId, reports);
      return { summary };
    },
  );

  app.get<{ Querystring: { workspaceId?: string } }>(
    "/calibration",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const view = await getCalibrationView(app.prisma, request.query.workspaceId);
      if (!view) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      return { calibration: view };
    },
  );

  app.patch("/calibration", async (request, reply) => {
    const body = request.body as CalibrationPatchRequest | undefined;
    if (!body?.workspaceId || !body?.section || !body?.values) {
      return reply.status(400).send({
        error: "workspaceId, section, and values are required",
      });
    }

    const result = await patchCalibration(app.prisma, body);
    if ("error" in result) {
      return reply.status(404).send({ error: result.error });
    }

    if (result.changes.length > 0) {
      await app.prisma.eventLog.create({
        data: {
          workspaceId: body.workspaceId,
          eventType: "diagnostics.calibration.changed",
          traceId: newUlid(),
          payload: { changes: result.changes } as object,
        },
      });

      await emitCalibrationChanged(
        app.events,
        newUlid(),
        body.workspaceId,
        result.changes.length,
        body.section,
      );
    }

    return { calibration: result.view, changes: result.changes };
  });

  app.post("/calibration/benchmark", async (request, reply) => {
    return runWithLlmCallAsync(request.llmCallCollector, async () => {
    const body = request.body as CalibrationBenchmarkRequest | undefined;
    if (!body?.workspaceId || !body?.retrievalTraceId) {
      return reply.status(400).send({
        error: "workspaceId and retrievalTraceId are required",
      });
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

    const beforeInput = await buildReportInputFromTrace(
      app.prisma,
      body.retrievalTraceId,
      originalSnapshot,
    );
    const beforeMetrics = computeRetrievalQualityMetrics(beforeInput);

    const workspace = await getWorkspaceRetrievalConfig(app.prisma, body.workspaceId);
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const calibrationView = await getCalibrationView(app.prisma, body.workspaceId);
    const baseCalibration = calibrationView?.config;
    const appliedCalibration = body.calibrationOverrides
      ? mergeSystemCalibration(workspace, {
          ...baseCalibration,
          ...body.calibrationOverrides,
        })
      : baseCalibration;

    const benchmarkTraceId = newUlid();
    let benchmarkContextPackage = originalSnapshot.contextPackage;
    let benchmarkOptimizedPackage =
      originalSnapshot.compressionArtifacts[0]?.optimizedContextPackage;

    if (body.rerunRetrieval !== false) {
      let config = mergeRetrievalConfig(workspace);
      if (appliedCalibration) {
        config = applyCalibrationToRetrievalConfig(config, appliedCalibration, originalSnapshot.retrievalMode);
      }

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
          ...(appliedCalibration?.retrieval
            ? { calibration: appliedCalibration.retrieval }
            : {}),
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
      const compressionWorkspace = await getWorkspaceCompressionConfig(app.prisma, body.workspaceId);
      if (!compressionWorkspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      const compressionTraceId = newUlid();
      const fidelityMode =
        compressionWorkspace.compression?.default_fidelity_mode ?? DEFAULT_COMPRESSION_FIDELITY;
      const nuancePreservation =
        appliedCalibration?.compression.summarizationThreshold ??
        compressionWorkspace.compression?.default_nuance_preservation ??
        DEFAULT_NUANCE_PRESERVATION;
      const tokenOptimization =
        appliedCalibration?.compression.fidelityAggressiveness ??
        compressionWorkspace.compression?.default_token_optimization ??
        DEFAULT_TOKEN_OPTIMIZATION;

      await createCompressionOperation(app.prisma, {
        workspaceId: body.workspaceId,
        traceId: compressionTraceId,
        retrievalTraceId: benchmarkTraceId,
        fidelityMode,
        nuancePreservation,
        tokenOptimization,
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
        },
        traceId: compressionTraceId,
        events: app.events,
        abstractionClient,
        runtimeOverrides: compressionWorkspace.compression?.runtime,
      });

      benchmarkOptimizedPackage = compressionResult.optimizedContextPackage;

      const stored: StoredCompressionResult = {
        retrievalTraceId: benchmarkTraceId,
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

    if (body.rerunRendering) {
      const deliveryId = newUlid();
      await createContextRenderOperation(app.prisma, {
        workspaceId: body.workspaceId,
        deliveryId,
        retrievalTraceId: benchmarkTraceId,
        mode: "balanced",
      });

      const deliveryResult = await runContextRenderPipeline({
        contextPackage: benchmarkOptimizedPackage ?? benchmarkContextPackage,
        workspaceId: body.workspaceId,
        deliveryId,
        mode: "balanced",
        events: app.events,
      });

      const stored: StoredContextRenderResult = {
        retrievalTraceId: benchmarkTraceId,
        mode: "balanced",
        stages: deliveryResult.stages,
        originalContextPackage: deliveryResult.preparedContextPackage,
        deliveryContext: deliveryResult.deliveryContext,
        renderingDecisions: deliveryResult.renderingDecisions,
        ...(deliveryResult.error ? { error: deliveryResult.error } : {}),
      };

      await completeContextRenderOperation(
        app.prisma,
        deliveryId,
        stored,
        deliveryResult.failed ? "failed" : "completed",
      );
    }

    const benchmarkSnapshot = await getReplaySnapshotByTraceId(app.prisma, benchmarkTraceId);
    const afterInput = benchmarkSnapshot
      ? await buildReportInputFromTrace(app.prisma, benchmarkTraceId, benchmarkSnapshot)
      : beforeInput;

    const afterMetrics = computeRetrievalQualityMetrics(afterInput);
    const comparison = buildBenchmarkComparison({
      originalSnapshot,
      benchmarkContextPackage,
      ...(benchmarkOptimizedPackage ? { benchmarkOptimizedPackage } : {}),
    });

    const benchmarkId = newUlid();
    const benchmarkSet = createWorkspaceBenchmarkSet(body.workspaceId);
    const benchmarkEvaluation = evaluateBenchmarkSet(
      benchmarkSet,
      originalSnapshot.originalQuery,
      benchmarkContextPackage,
      benchmarkTraceId,
    );

    const result = {
      benchmarkId,
      retrievalTraceId: body.retrievalTraceId,
      workspaceId: body.workspaceId,
      beforeMetrics,
      afterMetrics,
      metricDeltas: computeMetricDeltas(beforeMetrics, afterMetrics),
      comparison,
      calibrationApplied: body.calibrationOverrides ?? appliedCalibration ?? {},
      previousCalibration: baseCalibration,
      ...(benchmarkEvaluation ? { benchmarkEvaluation } : {}),
      executedAt: new Date().toISOString(),
      benchmarkTraceId,
    };

    await emitCalibrationBenchmarkExecuted(
      app.events,
      newUlid(),
      body.workspaceId,
      benchmarkId,
      body.retrievalTraceId,
    );

    return { benchmark: result };
    });
  });
}
