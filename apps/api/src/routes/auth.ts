import type { FastifyInstance } from "fastify";
import { PLATFORM_EVENT_TYPES } from "@memory-middleware/shared-types";
import { emitPlatformEvent } from "../lib/platform-events.js";
import { readBootstrapStatus } from "../lib/workspace-provision.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/auth/me", async (request, reply) => {
    if (!request.auth || request.auth.kind !== "session") {
      return reply.status(401).send({ error: "Session required" });
    }

    const userId = request.auth.userId;
    if (!userId) return reply.status(401).send({ error: "Invalid session" });

    const memberships = await app.prisma.workspaceMembership.findMany({
      where: { userId },
      include: { workspace: true },
      orderBy: { createdAt: "asc" },
    });

    const primary = memberships[0];
    if (!primary) {
      return reply.status(404).send({ error: "No workspace membership found" });
    }

    await emitPlatformEvent(app.events, {
      eventType: PLATFORM_EVENT_TYPES.AUTH_SUCCESS,
      traceId: request.traceId,
      workspaceId: primary.workspaceId,
      metadata: { userId: request.auth.userId },
    });

    return {
      user: {
        userId: request.auth.userId,
        email: request.auth.email,
        isPlatformAdmin: request.auth.isPlatformAdmin ?? false,
      },
      workspace: {
        workspaceId: primary.workspace.id,
        name: primary.workspace.name,
        plan: primary.workspace.plan,
        archived: primary.workspace.archived,
        role: primary.role as string,
        bootstrap: readBootstrapStatus(primary.workspace.config),
      },
      memberships: memberships.map((m) => ({
        membershipId: m.id,
        workspaceId: m.workspaceId,
        role: m.role,
        workspaceName: m.workspace.name,
      })),
    };
  });
}
