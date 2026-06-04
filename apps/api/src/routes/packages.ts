import type { FastifyInstance } from "fastify";
import {
  archiveInstalledPackage,
  clonePackage,
  comparePackage,
  exportPackage,
  installPackage,
  rollbackPackage,
  updatePackage,
} from "@memory-middleware/domain-engine";
import type { PackageManifest } from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";
import { createPrismaDomainEngineStore } from "../lib/domain-engine/index.js";
import { sendDomainEngineError } from "../lib/domain-engine-route-errors.js";
import { enforceWorkspaceScope, hasPermission, type AuthContext } from "../middleware/auth.js";

function requireWorkspaceAdmin(auth: AuthContext | undefined, reply: import("fastify").FastifyReply): auth is AuthContext {
  if (!auth) {
    reply.status(401).send({ error: "Authentication required" });
    return false;
  }
  if (!hasPermission(auth, "admin")) {
    reply.status(403).send({ error: "Workspace admin permission required" });
    return false;
  }
  return true;
}

function requireMiddlewareAdmin(
  auth: AuthContext | undefined,
  reply: import("fastify").FastifyReply,
): auth is AuthContext {
  if (!auth) {
    reply.status(401).send({ error: "Authentication required" });
    return false;
  }
  if (!auth.isMiddlewareAdmin) {
    reply.status(403).send({ error: "Middleware admin required" });
    return false;
  }
  return true;
}

function requireClonePermission(
  auth: AuthContext,
  targetWorkspaceId: string,
  reply: import("fastify").FastifyReply,
): boolean {
  if (auth.isMiddlewareAdmin || auth.isPlatformAdmin) return true;
  if (auth.workspaceId === targetWorkspaceId && hasPermission(auth, "admin")) return true;
  reply.status(403).send({ error: "Platform admin required to clone across workspaces" });
  return false;
}

function packageDeps(app: FastifyInstance, traceId: string) {
  return {
    store: createPrismaDomainEngineStore(app.prisma),
    events: app.events,
    traceId,
  };
}

function parseManifest(value: unknown): PackageManifest | { error: string } {
  if (!value || typeof value !== "object") {
    return { error: "manifest must be an object" };
  }
  const m = value as Record<string, unknown>;
  if (typeof m.packageKey !== "string" || !m.packageKey) {
    return { error: "manifest.packageKey is required" };
  }
  if (typeof m.name !== "string" || !m.name) {
    return { error: "manifest.name is required" };
  }
  if (typeof m.version !== "string" || !m.version) {
    return { error: "manifest.version is required" };
  }
  if (!Array.isArray(m.domains)) {
    return { error: "manifest.domains must be an array" };
  }
  return value as PackageManifest;
}

export async function registerPackageRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { workspaceId: string; includeArchived?: string } }>(
    "/packages/installed",
    async (request, reply) => {
      if (!requireWorkspaceAdmin(request.auth, reply)) return;
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const includeArchived = request.query.includeArchived === "true";
      const packages = await store.listInstalledPackages(workspaceId, includeArchived);
      return { workspaceId, packages };
    },
  );

  app.post("/packages/install", async (request, reply) => {
    if (!requireWorkspaceAdmin(request.auth, reply)) return;
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const failOnConflict = body?.failOnConflict !== false;
    const packageDefinitionId =
      typeof body?.packageDefinitionId === "string" ? body.packageDefinitionId : undefined;
    let manifest: PackageManifest | undefined;
    if (body?.manifest) {
      const parsed = parseManifest(body.manifest);
      if ("error" in parsed) return reply.status(400).send({ error: parsed.error });
      manifest = parsed;
    }

    if (!manifest && !packageDefinitionId) {
      return reply.status(400).send({
        error: "manifest or packageDefinitionId is required",
      });
    }

    try {
      const installed = await installPackage(packageDeps(app, newUlid()), {
        workspaceId,
        ...(manifest ? { manifest } : {}),
        ...(packageDefinitionId ? { packageDefinitionId } : {}),
        failOnConflict,
        ...(request.auth?.userId ? { installedByUserId: request.auth.userId } : {}),
      });
      return { installed };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post("/packages/export", async (request, reply) => {
    if (!requireWorkspaceAdmin(request.auth, reply)) return;
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    const installedPackageId = body?.installedPackageId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (typeof installedPackageId !== "string" || !installedPackageId) {
      return reply.status(400).send({ error: "installedPackageId is required" });
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const store = createPrismaDomainEngineStore(app.prisma);
    const row = await store.getInstalledPackage(installedPackageId);
    if (!row || row.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Installed package not found" });
    }

    try {
      const manifest = await exportPackage(
        packageDeps(app, newUlid()),
        installedPackageId,
        workspaceId,
      );
      return { manifest };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post("/packages/compare", async (request, reply) => {
    if (!requireWorkspaceAdmin(request.auth, reply)) return;
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    const installedPackageId = body?.installedPackageId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (typeof installedPackageId !== "string" || !installedPackageId) {
      return reply.status(400).send({ error: "installedPackageId is required" });
    }
    const parsed = parseManifest(body?.candidateManifest);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const store = createPrismaDomainEngineStore(app.prisma);
    const row = await store.getInstalledPackage(installedPackageId);
    if (!row || row.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Installed package not found" });
    }

    try {
      const diff = await comparePackage(
        packageDeps(app, newUlid()),
        installedPackageId,
        parsed,
      );
      return { diff };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post("/packages/rollback", async (request, reply) => {
    if (!requireWorkspaceAdmin(request.auth, reply)) return;
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    const installedPackageId = body?.installedPackageId;
    const snapshotVersion = body?.snapshotVersion;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (typeof installedPackageId !== "string" || !installedPackageId) {
      return reply.status(400).send({ error: "installedPackageId is required" });
    }
    if (typeof snapshotVersion !== "string" || !snapshotVersion) {
      return reply.status(400).send({ error: "snapshotVersion is required" });
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const store = createPrismaDomainEngineStore(app.prisma);
    const row = await store.getInstalledPackage(installedPackageId);
    if (!row || row.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Installed package not found" });
    }

    try {
      const installed = await rollbackPackage(
        packageDeps(app, newUlid()),
        installedPackageId,
        workspaceId,
        snapshotVersion,
      );
      return { installed };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post("/packages/update", async (request, reply) => {
    if (!requireWorkspaceAdmin(request.auth, reply)) return;
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    const installedPackageId = body?.installedPackageId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (typeof installedPackageId !== "string" || !installedPackageId) {
      return reply.status(400).send({ error: "installedPackageId is required" });
    }
    const parsed = parseManifest(body?.manifest);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const failOnConflict = body?.failOnConflict !== false;
    const store = createPrismaDomainEngineStore(app.prisma);
    const row = await store.getInstalledPackage(installedPackageId);
    if (!row || row.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Installed package not found" });
    }

    try {
      const installed = await updatePackage(
        packageDeps(app, newUlid()),
        installedPackageId,
        workspaceId,
        parsed,
        failOnConflict,
      );
      return { installed };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post("/packages/clone", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const sourceInstalledPackageId = body?.sourceInstalledPackageId;
    const targetWorkspaceId = body?.targetWorkspaceId;
    if (typeof sourceInstalledPackageId !== "string" || !sourceInstalledPackageId) {
      return reply.status(400).send({ error: "sourceInstalledPackageId is required" });
    }
    if (typeof targetWorkspaceId !== "string" || !targetWorkspaceId) {
      return reply.status(400).send({ error: "targetWorkspaceId is required" });
    }
    if (!request.auth) {
      return reply.status(401).send({ error: "Authentication required" });
    }
    if (!requireClonePermission(request.auth, targetWorkspaceId, reply)) return;

    const store = createPrismaDomainEngineStore(app.prisma);
    const source = await store.getInstalledPackage(sourceInstalledPackageId);
    if (!source) {
      return reply.status(404).send({ error: "Source installed package not found" });
    }
    if (
      source.workspaceId !== request.auth.workspaceId &&
      !request.auth.isMiddlewareAdmin &&
      !request.auth.isPlatformAdmin
    ) {
      return reply.status(403).send({ error: "Cannot clone from another workspace" });
    }

    try {
      const installed = await clonePackage(
        packageDeps(app, newUlid()),
        sourceInstalledPackageId,
        targetWorkspaceId,
        request.auth.userId,
      );
      return { installed };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post<{ Params: { id: string } }>(
    "/packages/installed/:id/archive",
    async (request, reply) => {
      if (!requireWorkspaceAdmin(request.auth, reply)) return;
      const body = request.body as Record<string, unknown> | null;
      const wsId = body?.workspaceId;
      if (typeof wsId !== "string" || !wsId) {
        return reply.status(400).send({ error: "workspaceId is required" });
      }
      if (!enforceWorkspaceScope(request, reply, wsId)) return;

      const store = createPrismaDomainEngineStore(app.prisma);
      const row = await store.getInstalledPackage(request.params.id);
      if (!row || row.workspaceId !== wsId) {
        return reply.status(404).send({ error: "Installed package not found" });
      }

      try {
        const archived = await archiveInstalledPackage(
          packageDeps(app, newUlid()),
          request.params.id,
          wsId,
        );
        return { installed: archived };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.get("/platform/packages", async (request, reply) => {
    if (!requireMiddlewareAdmin(request.auth, reply)) return;
    const publishedOnly = (request.query as Record<string, string>).published === "true";
    const store = createPrismaDomainEngineStore(app.prisma);
    const packages = await store.listPackageDefinitions(publishedOnly);
    return { packages };
  });

  app.post("/platform/packages", async (request, reply) => {
    if (!requireMiddlewareAdmin(request.auth, reply)) return;
    const body = request.body as Record<string, unknown> | null;
    const parsed = parseManifest(body?.manifest ?? body);
    if ("error" in parsed) return reply.status(400).send({ error: parsed.error });
    const published = body?.published === true;

    try {
      const store = createPrismaDomainEngineStore(app.prisma);
      const record = await store.upsertPackageDefinition(parsed, published);
      return { packageDefinition: record };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.patch<{ Params: { id: string } }>("/platform/packages/:id", async (request, reply) => {
    if (!requireMiddlewareAdmin(request.auth, reply)) return;
    const body = request.body as Record<string, unknown> | null;
    const store = createPrismaDomainEngineStore(app.prisma);
    const existing = await store.getPackageDefinition(request.params.id);
    if (!existing) {
      return reply.status(404).send({ error: "Package definition not found" });
    }

    const manifest = body?.manifest
      ? parseManifest(body.manifest)
      : existing.manifest;
    if ("error" in manifest) return reply.status(400).send({ error: manifest.error });

    const published =
      typeof body?.published === "boolean" ? body.published : existing.published;

    try {
      const record = await store.upsertPackageDefinition(
        {
          ...manifest,
          packageKey: existing.packageKey,
        },
        published,
      );
      return { packageDefinition: record };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });
}
