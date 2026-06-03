import type { FastifyInstance } from "fastify";
import {
  DEFAULT_API_KEY_PERMISSIONS,
  newUlid,
  PLATFORM_EVENT_TYPES,
  type ApiKeyPermission,
} from "@memory-middleware/shared-types";
import {
  extractKeyPrefix,
  generateRawApiKey,
  hashApiKey,
  parsePermissions,
} from "../lib/api-keys.js";
import { emitPlatformEvent } from "../lib/platform-events.js";
import { readBootstrapStatus } from "../lib/workspace-provision.js";
import { hasPermission } from "../middleware/auth.js";

export async function registerPlatformRoutes(app: FastifyInstance): Promise<void> {
  app.get("/platform/workspace", async (request, reply) => {
    if (!request.auth) return reply.status(401).send({ error: "Authentication required" });

    const workspace = await app.prisma.workspace.findUnique({
      where: { id: request.auth.workspaceId },
    });
    if (!workspace) return reply.status(404).send({ error: "Workspace not found" });

    const [retrievalCount, replayCount, eventCount] = await Promise.all([
      app.prisma.retrievalOperation.count({
        where: { workspaceId: workspace.id },
      }),
      app.prisma.replaySnapshot.count({
        where: { workspaceId: workspace.id },
      }),
      app.prisma.eventLog.count({
        where: { workspaceId: workspace.id },
      }),
    ]);

    return {
      workspace: {
        workspaceId: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
        archived: workspace.archived,
        createdAt: workspace.createdAt.toISOString(),
        bootstrap: readBootstrapStatus(workspace.config),
      },
      metrics: {
        retrievalOperations: retrievalCount,
        replaySnapshots: replayCount,
        eventLogs: eventCount,
        contextualHealth: replayCount > 0 ? "operational" : "initializing",
      },
    };
  });

  app.get("/platform/api-keys", async (request, reply) => {
    if (!request.auth || !hasPermission(request.auth, "admin")) {
      return reply.status(403).send({ error: "Admin permission required" });
    }

    const keys = await app.prisma.apiKey.findMany({
      where: { workspaceId: request.auth.workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return {
      keys: keys.map((k) => ({
        id: k.id,
        workspaceId: k.workspaceId,
        name: k.name,
        permissions: parsePermissions(k.permissions),
        createdAt: k.createdAt.toISOString(),
        lastUsedAt: k.lastUsedAt?.toISOString(),
        revoked: k.revoked,
        keyPrefix: k.keyPrefix,
      })),
    };
  });

  app.post<{
    Body: { name?: string; permissions?: ApiKeyPermission[] };
  }>("/platform/api-keys", async (request, reply) => {
    if (!request.auth || !hasPermission(request.auth, "admin")) {
      return reply.status(403).send({ error: "Admin permission required" });
    }

    const name = request.body?.name?.trim() || "Operational API Key";
    const permissions = request.body?.permissions?.length
      ? request.body.permissions
      : DEFAULT_API_KEY_PERMISSIONS;
    const rawApiKey = generateRawApiKey();
    const id = newUlid();

    await app.prisma.apiKey.create({
      data: {
        id,
        workspaceId: request.auth.workspaceId,
        hashedKey: hashApiKey(rawApiKey),
        keyPrefix: extractKeyPrefix(rawApiKey),
        name,
        permissions,
      },
    });

    await emitPlatformEvent(app.events, {
      eventType: PLATFORM_EVENT_TYPES.API_KEY_CREATED,
      traceId: request.traceId,
      workspaceId: request.auth.workspaceId,
      metadata: { apiKeyId: id, name },
    });

    return {
      key: { id, name, permissions, keyPrefix: extractKeyPrefix(rawApiKey) },
      rawApiKey,
    };
  });

  app.post<{ Params: { keyId: string } }>(
    "/platform/api-keys/:keyId/revoke",
    async (request, reply) => {
      if (!request.auth || !hasPermission(request.auth, "admin")) {
        return reply.status(403).send({ error: "Admin permission required" });
      }

      const key = await app.prisma.apiKey.findFirst({
        where: { id: request.params.keyId, workspaceId: request.auth.workspaceId },
      });
      if (!key) return reply.status(404).send({ error: "API key not found" });

      await app.prisma.apiKey.update({
        where: { id: key.id },
        data: { revoked: true },
      });

      await emitPlatformEvent(app.events, {
        eventType: PLATFORM_EVENT_TYPES.API_KEY_REVOKED,
        traceId: request.traceId,
        workspaceId: request.auth.workspaceId,
        metadata: { apiKeyId: key.id },
      });

      return { revoked: true, id: key.id };
    },
  );

  app.get("/platform/members", async (request, reply) => {
    if (!request.auth) return reply.status(401).send({ error: "Authentication required" });

    const members = await app.prisma.workspaceMembership.findMany({
      where: { workspaceId: request.auth.workspaceId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });

    return {
      members: members.map((m) => ({
        membershipId: m.id,
        workspaceId: m.workspaceId,
        userId: m.userId,
        email: m.user.email,
        role: m.role,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  });

  app.get("/platform/security-events", async (request, reply) => {
    if (!request.auth || !hasPermission(request.auth, "admin")) {
      return reply.status(403).send({ error: "Admin permission required" });
    }

    const limit = Number((request.query as { limit?: string }).limit ?? 50);
    const events = await app.prisma.securityEvent.findMany({
      where: { workspaceId: request.auth.workspaceId },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
    });

    return {
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        severity: e.severity,
        metadata: e.metadata,
        createdAt: e.createdAt.toISOString(),
      })),
    };
  });
}
