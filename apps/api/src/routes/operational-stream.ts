import type { FastifyInstance } from "fastify";
import type { OperationalStreamEnvelope } from "@memory-middleware/shared-types";
import type { OperationalStreamHub } from "../lib/operational-stream-hub.js";
import { enforceWorkspaceScope } from "../middleware/auth.js";

function formatSseData(envelope: OperationalStreamEnvelope): string {
  return `data: ${JSON.stringify(envelope)}\n\n`;
}

export async function registerOperationalStreamRoutes(
  app: FastifyInstance,
  hub: OperationalStreamHub,
): Promise<void> {
  app.get<{ Params: { workspaceId: string } }>(
    "/workspaces/:workspaceId/operational-stream",
    { config: { compress: false } },
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

      reply.hijack();
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      const traceId = request.traceId;
      let closed = false;

      const unsubscribe = hub.subscribe({
        workspaceId,
        traceId,
        push(envelope) {
          if (closed) return false;
          try {
            reply.raw.write(formatSseData(envelope));
            return true;
          } catch {
            closed = true;
            return false;
          }
        },
      });

      const onClose = () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        reply.raw.end();
      };

      request.raw.on("close", onClose);
      request.raw.on("error", onClose);
    },
  );
}
