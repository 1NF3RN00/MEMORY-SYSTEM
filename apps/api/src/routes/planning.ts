import type { FastifyInstance } from "fastify";
import { runWithTimingAsync } from "@memory-middleware/observability";
import {
  benchmarkPlanning,
  batchReplayBenchmark,
  emitBenchmarkCompleted,
  emitModeTuningCompleted,
  listRetrievalModes,
  replayPlanning,
  runPlanningPipeline,
  tuneRetrievalModes,
} from "@memory-middleware/planning";
import { newUlid } from "@memory-middleware/shared-types";
import {
  createRetrievalPlanRecord,
  getRetrievalPlan,
  listRetrievalPlans,
  loadWorkspacePlanningContext,
  parsePlanningBenchmarkBody,
  parsePlanningBody,
  parsePlanningTuningBody,
} from "../lib/planning-store.js";
import { getWorkspaceRetrievalConfig } from "../lib/retrieval-store.js";
export async function registerPlanningRoutes(app: FastifyInstance): Promise<void> {
  app.get("/retrieval/modes", async () => {
    const modes = listRetrievalModes();
    return { modes };
  });

  app.post("/retrieval/plan", async (request, reply) => {
    return runWithTimingAsync(
      request.timingCollector,
      async () => {
    const parsed = parsePlanningBody(request.body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: parsed.error });
    }

    const workspace = await getWorkspaceRetrievalConfig(app.prisma, parsed.workspaceId);
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const planId = newUlid();
    const workspaceContext = await loadWorkspacePlanningContext(app.prisma, parsed.workspaceId);

    const result = await runPlanningPipeline({
      request: parsed,
      planId,
      workspaceContext,
      events: app.events,
      timingCollector: request.timingCollector,
    });

    await createRetrievalPlanRecord(app.prisma, {
      planId: result.plan.planId,
      workspaceId: parsed.workspaceId,
      query: parsed.query,
      retrievalMode: result.plan.retrievalMode,
      plan: result.plan,
      replayInput: result.replayInput,
      stages: result.stages,
      status: result.stages.some((s: { status: string }) => s.status === "failed") ? "fallback" : "completed",
    });

    return {
      planId: result.plan.planId,
      plan: result.plan,
      stages: result.stages,
      timingAudit: request.timingCollector.toAudit(),
      llmCallAudit: request.llmCallCollector.toAudit(),
    };
    },
      request.llmCallCollector,
    );
  });

  app.get<{ Params: { id: string } }>("/retrieval/plan/:id", async (request, reply) => {
    const stored = await getRetrievalPlan(app.prisma, request.params.id);
    if (!stored) {
      return reply.status(404).send({ error: "Retrieval plan not found" });
    }

    return {
      planId: stored.plan.planId,
      plan: stored.plan,
      stages: stored.stages,
      status: stored.status,
      replayInput: stored.replayInput,
    };
  });

  app.get<{ Params: { id: string } }>(
    "/retrieval/plan/:id/replay",
    async (request, reply) => {
      const stored = await getRetrievalPlan(app.prisma, request.params.id);
      if (!stored) {
        return reply.status(404).send({ error: "Retrieval plan not found" });
      }

      const workspaceContext = await loadWorkspacePlanningContext(
        app.prisma,
        stored.replayInput.workspaceId,
      );

      const replay = replayPlanning(
        stored.plan,
        stored.replayInput,
        workspaceContext,
      );

      return { replay };
    },
  );

  app.get<{ Querystring: { workspaceId: string; limit?: string } }>(
    "/retrieval/plans",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const limit = Number(request.query.limit ?? 50);
      const plans = await listRetrievalPlans(app.prisma, request.query.workspaceId, limit);
      return { workspaceId: request.query.workspaceId, plans };
    },
  );

  app.post("/retrieval/plan/tune", async (request, reply) => {
    const parsed = parsePlanningTuningBody(request.body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: parsed.error });
    }

    const workspace = await getWorkspaceRetrievalConfig(app.prisma, parsed.workspaceId);
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const workspaceContext = await loadWorkspacePlanningContext(app.prisma, parsed.workspaceId);
    const tuning = tuneRetrievalModes({
      workspaceId: parsed.workspaceId,
      query: parsed.query,
      workspaceContext,
    });

    await emitModeTuningCompleted(app.events, {
      planId: tuning.tuningId,
      workspaceId: parsed.workspaceId,
      extra: {
        recommended_mode: tuning.recommendedMode,
        precision_integrity_protected: tuning.precisionIntegrityProtected,
      },
    });

    return { tuning };
  });

  app.post("/retrieval/plan/benchmark", async (request, reply) => {
    const parsed = parsePlanningBenchmarkBody(request.body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: parsed.error });
    }

    const workspace = await getWorkspaceRetrievalConfig(app.prisma, parsed.workspaceId);
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const workspaceContext = await loadWorkspacePlanningContext(app.prisma, parsed.workspaceId);

    let storedPlan;
    if (parsed.planId) {
      const stored = await getRetrievalPlan(app.prisma, parsed.planId);
      if (!stored) {
        return reply.status(404).send({ error: "Retrieval plan not found" });
      }
      storedPlan = stored.plan;
    }

    const benchmark = benchmarkPlanning({
      workspaceId: parsed.workspaceId,
      query: parsed.query,
      ...(parsed.retrievalMode ? { retrievalMode: parsed.retrievalMode } : {}),
      ...(storedPlan ? { storedPlan } : {}),
      workspaceContext,
    });

    await emitBenchmarkCompleted(app.events, {
      planId: benchmark.benchmarkId,
      workspaceId: parsed.workspaceId,
      extra: {
        replay_matches: benchmark.replayMatches,
        pollution_controlled: benchmark.pollutionControlled,
        selected_mode: benchmark.selectedMode,
      },
    });

    return { benchmark };
  });

  app.post<{ Params: { id: string } }>(
    "/retrieval/plan/:id/benchmark",
    async (request, reply) => {
      const stored = await getRetrievalPlan(app.prisma, request.params.id);
      if (!stored) {
        return reply.status(404).send({ error: "Retrieval plan not found" });
      }

      const workspaceContext = await loadWorkspacePlanningContext(
        app.prisma,
        stored.replayInput.workspaceId,
      );

      const benchmark = benchmarkPlanning({
        workspaceId: stored.replayInput.workspaceId,
        query: stored.replayInput.query,
        retrievalMode: stored.plan.retrievalMode,
        storedPlan: stored.plan,
        workspaceContext,
      });

      await emitBenchmarkCompleted(app.events, {
        planId: benchmark.benchmarkId,
        workspaceId: stored.replayInput.workspaceId,
        extra: {
          replay_matches: benchmark.replayMatches,
          pollution_controlled: benchmark.pollutionControlled,
          plan_id: stored.plan.planId,
        },
      });

      return { benchmark };
    },
  );

  app.post<{ Querystring: { workspaceId: string; limit?: string } }>(
    "/retrieval/plans/benchmark",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const limit = Math.min(Number(request.query.limit ?? 20), 50);
      const planRecords = await listRetrievalPlans(app.prisma, request.query.workspaceId, limit);

      const plans = await Promise.all(
        planRecords.map(async (summary) => {
          const stored = await getRetrievalPlan(app.prisma, summary.planId);
          return stored
            ? { plan: stored.plan, workspaceId: summary.workspaceId ?? request.query.workspaceId }
            : null;
        }),
      );

      const validPlans = plans.filter((p): p is NonNullable<typeof p> => p !== null);
      const workspaceContext = await loadWorkspacePlanningContext(
        app.prisma,
        request.query.workspaceId,
      );

      const batch = batchReplayBenchmark({ plans: validPlans, workspaceContext });

      await emitBenchmarkCompleted(app.events, {
        planId: batch.benchmarkId,
        workspaceId: request.query.workspaceId,
        extra: {
          determinism_rate: batch.determinismRate,
          total_plans: batch.totalPlans,
        },
      });

      return { batch };
    },
  );
}
