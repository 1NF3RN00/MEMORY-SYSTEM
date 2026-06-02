import { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import {
  buildContextDiff,
  compareDeliveryContexts,
  runContextRenderPipeline,
} from "@memory-middleware/context-delivery";
import { DEFAULT_DELIVERY_MODE, newUlid } from "@memory-middleware/shared-types";
import type { ContextRenderStageRecord } from "@memory-middleware/shared-types";
import {
  completeContextRenderOperation,
  createContextRenderOperation,
  getContextRenderTrace,
  getDeliveryArtifactsForTrace,
  listContextRenderTraces,
  parseContextRenderBody,
  resolveContextPackageForRender,
  type StoredContextRenderResult,
} from "../lib/context-store.js";
import { captureReplaySnapshotFromTrace } from "../lib/historian-store.js";

export async function registerContextRoutes(app: FastifyInstance): Promise<void> {
  app.post("/context/render", async (request, reply) => {
    const parsed = parseContextRenderBody(request.body);
    if ("error" in parsed) {
      return reply.status(400).send({ error: parsed.error });
    }

    const workspace = await app.prisma.workspace.findUnique({
      where: { id: parsed.workspaceId },
    });
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const resolved = await resolveContextPackageForRender(app.prisma, parsed);
    if ("error" in resolved) {
      return reply.status(400).send({ error: resolved.error });
    }

    const mode = parsed.mode ?? DEFAULT_DELIVERY_MODE;
    const deliveryId = newUlid();

    await createContextRenderOperation(app.prisma, {
      workspaceId: parsed.workspaceId,
      deliveryId,
      retrievalTraceId: resolved.retrievalTraceId,
      ...(resolved.compressionTraceId
        ? { compressionTraceId: resolved.compressionTraceId }
        : {}),
      mode,
    });

    try {
      const result = await runContextRenderPipeline({
        contextPackage: resolved.contextPackage,
        workspaceId: parsed.workspaceId,
        deliveryId,
        mode,
        events: app.events,
        onStage: async (stages: ContextRenderStageRecord[]) => {
          const existing = await app.prisma.contextRenderOperation.findFirst({
            where: { deliveryId },
            orderBy: { createdAt: "desc" },
          });
          const prev = (existing?.result ?? {}) as unknown as StoredContextRenderResult;
          const partial: StoredContextRenderResult = {
            ...prev,
            retrievalTraceId: resolved.retrievalTraceId,
            ...(resolved.compressionTraceId
              ? { compressionTraceId: resolved.compressionTraceId }
              : {}),
            mode,
            stages,
            originalContextPackage: resolved.contextPackage,
          };
          await app.prisma.contextRenderOperation.updateMany({
            where: { deliveryId },
            data: {
              result: JSON.parse(JSON.stringify(partial)) as Prisma.InputJsonValue,
            },
          });
        },
      });

      const stored: StoredContextRenderResult = {
        retrievalTraceId: resolved.retrievalTraceId,
        ...(resolved.compressionTraceId
          ? { compressionTraceId: resolved.compressionTraceId }
          : {}),
        mode,
        stages: result.stages,
        originalContextPackage: resolved.contextPackage,
        deliveryContext: result.deliveryContext,
        renderingDecisions: result.renderingDecisions,
        ...(result.error ? { error: result.error } : {}),
      };

      await completeContextRenderOperation(
        app.prisma,
        deliveryId,
        stored,
        result.failed ? "failed" : "completed",
      );

      await captureReplaySnapshotFromTrace(app.prisma, resolved.retrievalTraceId);

      if (result.failed) {
        return reply.status(500).send({
          error: result.error ?? "Context rendering failed",
          deliveryId,
          deliveryContext: result.deliveryContext,
          originalContextPackage: resolved.contextPackage,
        });
      }

      return {
        deliveryId,
        deliveryContext: result.deliveryContext,
        renderingDecisions: result.renderingDecisions,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stored: StoredContextRenderResult = {
        retrievalTraceId: resolved.retrievalTraceId,
        ...(resolved.compressionTraceId
          ? { compressionTraceId: resolved.compressionTraceId }
          : {}),
        mode,
        stages: [],
        originalContextPackage: resolved.contextPackage,
        error: message,
      };

      await completeContextRenderOperation(app.prisma, deliveryId, stored, "failed");

      return reply.status(500).send({
        error: message,
        deliveryId,
        originalContextPackage: resolved.contextPackage,
      });
    }
  });

  app.get<{ Params: { id: string } }>("/context/render/:id", async (request, reply) => {
    const trace = await getContextRenderTrace(app.prisma, request.params.id);
    if (!trace) {
      return reply.status(404).send({ error: "Context render trace not found" });
    }
    return { trace };
  });

  app.get<{ Params: { id: string } }>(
    "/context/render/:id/replay",
    async (request, reply) => {
      const trace = await getContextRenderTrace(app.prisma, request.params.id);
      if (!trace) {
        return reply.status(404).send({ error: "Context render trace not found" });
      }

      if (!trace.originalContextPackage || !trace.deliveryContext || !trace.renderingDecisions) {
        return reply.status(400).send({ error: "Render trace is incomplete for replay" });
      }

      const diff = buildContextDiff(
        trace.originalContextPackage,
        trace.deliveryContext,
        trace.renderingDecisions.traceStripping,
      );

      return {
        deliveryId: trace.deliveryId,
        retrievalTraceId: trace.retrievalTraceId,
        mode: trace.mode,
        stages: trace.stages,
        renderingDecisions: trace.renderingDecisions,
        originalContextPackage: trace.originalContextPackage,
        deliveryContext: trace.deliveryContext,
        diff,
      };
    },
  );

  app.post("/context/render/compare", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const deliveryIdA = body?.deliveryIdA;
    const deliveryIdB = body?.deliveryIdB;

    if (typeof deliveryIdA !== "string" || typeof deliveryIdB !== "string") {
      return reply.status(400).send({ error: "deliveryIdA and deliveryIdB are required" });
    }

    const traceA = await getContextRenderTrace(app.prisma, deliveryIdA);
    const traceB = await getContextRenderTrace(app.prisma, deliveryIdB);

    if (!traceA?.deliveryContext) {
      return reply.status(404).send({ error: "deliveryIdA not found or incomplete" });
    }
    if (!traceB?.deliveryContext) {
      return reply.status(404).send({ error: "deliveryIdB not found or incomplete" });
    }

    const comparison = compareDeliveryContexts(
      traceA.deliveryContext,
      traceB.deliveryContext,
      traceA.originalContextPackage,
    );

    const diffA = traceA.originalContextPackage && traceA.renderingDecisions
      ? buildContextDiff(
          traceA.originalContextPackage,
          traceA.deliveryContext,
          traceA.renderingDecisions.traceStripping,
        )
      : null;

    const diffB = traceB.originalContextPackage && traceB.renderingDecisions
      ? buildContextDiff(
          traceB.originalContextPackage,
          traceB.deliveryContext,
          traceB.renderingDecisions.traceStripping,
        )
      : null;

    return {
      comparison,
      traceA: {
        deliveryId: traceA.deliveryId,
        mode: traceA.mode,
        renderedContext: traceA.deliveryContext.renderedContext,
        diff: diffA,
      },
      traceB: {
        deliveryId: traceB.deliveryId,
        mode: traceB.mode,
        renderedContext: traceB.deliveryContext.renderedContext,
        diff: diffB,
      },
    };
  });

  app.get<{ Querystring: { workspaceId?: string; limit?: string } }>(
    "/context/render",
    async (request) => {
      const limit = Number(request.query.limit ?? 50);
      const traces = await listContextRenderTraces(
        app.prisma,
        request.query.workspaceId,
        limit,
      );
      return { traces };
    },
  );
}
