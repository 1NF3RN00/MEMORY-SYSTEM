import type { FastifyInstance } from "fastify";
import {
  archiveOperationalObject,
  createOperationalObject,
  deleteOperationalObject,
  listOperationalObjects,
  updateOperationalObject,
  type ListOperationalObjectsQuery,
} from "@memory-middleware/domain-engine";
import { newUlid } from "@memory-middleware/shared-types";
import { createPrismaDomainEngineStore } from "../lib/domain-engine/index.js";
import { sendDomainEngineError } from "../lib/domain-engine-route-errors.js";
import { enforceWorkspaceScope } from "../middleware/auth.js";
import { enforceOperationalPermission } from "../middleware/operational-rbac.js";

function engineDeps(app: FastifyInstance, traceId: string) {
  return {
    store: createPrismaDomainEngineStore(app.prisma),
    events: app.events,
    traceId,
  };
}

function parseMetadataMatch(raw: string | undefined): Record<string, string | string[]> | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string | string[]>;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

export async function registerObjectRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      workspaceId: string;
      objectType?: string;
      status?: string;
      metadataMatch?: string;
      includeArchived?: string;
      limit?: string;
      cursor?: string;
    };
  }>("/objects", async (request, reply) => {
    const { workspaceId, objectType, status, metadataMatch, includeArchived, limit, cursor } =
      request.query;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId query parameter required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const match = parseMetadataMatch(metadataMatch);
    try {
      const listQuery: ListOperationalObjectsQuery = {
        workspaceId,
      };
      if (objectType) listQuery.objectType = objectType;
      if (status) listQuery.status = status;
      if (match) listQuery.metadataMatch = match;
      if (includeArchived === "true") listQuery.includeArchived = true;
      if (limit) {
        const parsedLimit = Number(limit);
        if (Number.isFinite(parsedLimit)) listQuery.limit = parsedLimit;
      }
      if (cursor) listQuery.cursor = cursor;

      const result = await listOperationalObjects(engineDeps(app, newUlid()), listQuery);
      return { workspaceId, ...result };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.get<{ Params: { objectId: string }; Querystring: { workspaceId: string } }>(
    "/objects/:objectId",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const object = await store.getOperationalObject(request.params.objectId);
      if (!object || object.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Operational object not found" });
      }
      return { object };
    },
  );

  app.post("/objects", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const metadata =
      body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? (body.metadata as Record<string, unknown>)
        : {};

    try {
      const object = await createOperationalObject(engineDeps(app, newUlid()), {
        workspaceId,
        objectType: String(body?.objectType ?? ""),
        name: String(body?.name ?? ""),
        status: String(body?.status ?? ""),
        metadata,
      });
      return { object };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.patch<{ Params: { objectId: string } }>("/objects/:objectId", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const store = createPrismaDomainEngineStore(app.prisma);
    const existing = await store.getOperationalObject(request.params.objectId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Operational object not found" });
    }

    try {
      const object = await updateOperationalObject(engineDeps(app, newUlid()), request.params.objectId, {
        ...(typeof body?.name === "string" ? { name: body.name } : {}),
        ...(typeof body?.status === "string" ? { status: body.status } : {}),
        ...(body?.metadata &&
        typeof body.metadata === "object" &&
        !Array.isArray(body.metadata)
          ? { metadata: body.metadata as Record<string, unknown> }
          : {}),
      });
      return { object };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post<{ Params: { objectId: string } }>(
    "/objects/:objectId/archive",
    async (request, reply) => {
      const body = request.body as Record<string, unknown> | null;
      const workspaceId = body?.workspaceId;
      if (typeof workspaceId !== "string" || !workspaceId) {
        return reply.status(400).send({ error: "workspaceId is required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const existing = await store.getOperationalObject(request.params.objectId);
      if (!existing || existing.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Operational object not found" });
      }

      try {
        const object = await archiveOperationalObject(
          engineDeps(app, newUlid()),
          request.params.objectId,
        );
        return { object };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.delete<{ Params: { objectId: string } }>("/objects/:objectId", async (request, reply) => {
    const workspaceId = (request.query as Record<string, string>).workspaceId;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId query parameter required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "hard_delete", { workspaceId }))) {
      return;
    }

    const store = createPrismaDomainEngineStore(app.prisma);
    const existing = await store.getOperationalObject(request.params.objectId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Operational object not found" });
    }

    try {
      await deleteOperationalObject(engineDeps(app, newUlid()), request.params.objectId);
      return { deleted: true };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });
}
