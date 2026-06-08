import type { FastifyInstance } from "fastify";
import {
  CLEAR_DATA_CONFIRMATION,
  clearWorkspaceData,
} from "../lib/workspace-clear.js";
import { loadDashboardBootstrapSummary } from "../lib/dashboard-bootstrap.js";
import { getWorkspaceMetricsSummary } from "../lib/metrics-aggregation-store.js";
import { enforceWorkspaceScope } from "../middleware/auth.js";

export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/dashboard-bootstrap",
    async (request, reply) => {
      const { workspaceId } = request.params;
      if (!enforceWorkspaceScope(request, reply, workspaceId)) {
        return;
      }

      const workspace = await app.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });
      if (!workspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      const payload = await loadDashboardBootstrapSummary(
        app.prisma,
        workspaceId,
        request.traceId,
      );

      try {
        await app.events.emit({
          event_type: "dashboard.bootstrap.loaded",
          trace_id: request.traceId,
          metadata: {
            workspace_id: workspaceId,
            tier: payload.tier,
            memory_count: payload.memories.length,
            retrieval_trace_count: payload.retrievalTraces.length,
            ingestion_trace_count: payload.ingestionTraces.length,
          },
        });
      } catch {
        // Bootstrap must stay available even when the event sink fails.
      }

      return payload;
    },
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/metrics/summary",
    async (request, reply) => {
      const { workspaceId } = request.params;
      if (!enforceWorkspaceScope(request, reply, workspaceId)) {
        return;
      }

      const workspace = await app.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true },
      });
      if (!workspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      return getWorkspaceMetricsSummary(app.prisma, workspaceId);
    },
  );

  app.get("/workspaces/default", async (request, reply) => {
    if (request.auth?.workspaceId) {
      const workspace = await app.prisma.workspace.findUnique({
        where: { id: request.auth.workspaceId },
      });
      if (!workspace) {
        return reply.status(404).send({ error: "Workspace not found" });
      }
      return {
        id: workspace.id,
        workspaceId: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
      };
    }

    const workspace = await app.prisma.workspace.findUnique({
      where: { slug: "default" },
    });

    if (!workspace) {
      return reply.status(404).send({
        error: "Default workspace not found. Run: npm run db:seed",
      });
    }

    return {
      id: workspace.id,
      workspaceId: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    };
  });

  app.post<{ Body: { confirmation?: string } }>(
    "/workspaces/default/clear",
    async (request, reply) => {
      const confirmation = request.body?.confirmation?.trim().toLowerCase();
      if (confirmation !== CLEAR_DATA_CONFIRMATION) {
        return reply.status(400).send({
          error: `Confirmation must exactly match: ${CLEAR_DATA_CONFIRMATION}`,
        });
      }

      const workspace = await app.prisma.workspace.findUnique({
        where: { slug: "default" },
      });

      if (!workspace) {
        return reply.status(404).send({
          error: "Default workspace not found. Run: npm run db:seed",
        });
      }

      const result = await clearWorkspaceData(app.prisma, workspace.id);

      await app.events.emit({
        event_type: "workspace.data.cleared",
        trace_id: request.traceId,
        metadata: {
          workspace_id: workspace.id,
          deleted: result.deleted,
        },
      });

      return result;
    },
  );
}
