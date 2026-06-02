import type { FastifyInstance } from "fastify";
import {
  CLEAR_DATA_CONFIRMATION,
  clearWorkspaceData,
} from "../lib/workspace-clear.js";

export async function registerWorkspaceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/workspaces/default", async (_request, reply) => {
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
