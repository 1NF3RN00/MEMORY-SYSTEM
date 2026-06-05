import type { FastifyInstance } from "fastify";
import {
  addFact,
  addGlobalFact,
  archiveDomain,
  archiveFact,
  archiveGlobalFact,
  archiveInstruction,
  createDomain,
  createInstruction,
  deleteDomain,
  deleteFact,
  deleteGlobalFact,
  updateDomain,
  updateFact,
  updateGlobalFact,
  versionInstruction,
} from "@memory-middleware/domain-engine";
import type { RelationshipNeighborhoodConstraint } from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT, newUlid } from "@memory-middleware/shared-types";
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

async function loadDomainForWorkspace(
  app: FastifyInstance,
  domainId: string,
  workspaceId: string,
) {
  const store = createPrismaDomainEngineStore(app.prisma);
  const domain = await store.getDomainById(domainId);
  if (!domain || domain.workspaceId !== workspaceId) return null;
  return domain;
}

export async function registerDomainRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { workspaceId: string; includeArchived?: string } }>(
    "/global-facts",
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
      const facts = await store.listActiveGlobalFacts(workspaceId);
      return { workspaceId, facts };
    },
  );

  app.post("/global-facts", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    try {
      const fact = await addGlobalFact(engineDeps(app, newUlid()), {
        workspaceId,
        key: String(body?.key ?? ""),
        title: String(body?.title ?? ""),
        content: String(body?.content ?? ""),
        ...(typeof body?.priority === "number" ? { priority: body.priority } : {}),
        ...(Array.isArray(body?.appliesToMetadataKeys)
          ? { appliesToMetadataKeys: body.appliesToMetadataKeys.filter((k): k is string => typeof k === "string") }
          : {}),
      });
      return { fact };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.patch<{ Params: { factId: string } }>("/global-facts/:factId", async (request, reply) => {
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
    const existing = await store.getGlobalFact(request.params.factId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Global fact not found" });
    }

    try {
      const fact = await updateGlobalFact(engineDeps(app, newUlid()), request.params.factId, {
        ...(typeof body?.title === "string" ? { title: body.title } : {}),
        ...(typeof body?.content === "string" ? { content: body.content } : {}),
        ...(typeof body?.priority === "number" ? { priority: body.priority } : {}),
        ...(Array.isArray(body?.appliesToMetadataKeys)
          ? {
              appliesToMetadataKeys: body.appliesToMetadataKeys.filter(
                (k): k is string => typeof k === "string",
              ),
            }
          : {}),
      });
      return { fact };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post<{ Params: { factId: string } }>(
    "/global-facts/:factId/archive",
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
      const existing = await store.getGlobalFact(request.params.factId);
      if (!existing || existing.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Global fact not found" });
      }

      try {
        const fact = await archiveGlobalFact(engineDeps(app, newUlid()), request.params.factId);
        return { fact };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.delete<{ Params: { factId: string } }>("/global-facts/:factId", async (request, reply) => {
    const workspaceId = (request.query as Record<string, string>).workspaceId;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId query parameter required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "hard_delete", { workspaceId }))) {
      return;
    }

    const store = createPrismaDomainEngineStore(app.prisma);
    const existing = await store.getGlobalFact(request.params.factId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Global fact not found" });
    }

    try {
      await deleteGlobalFact(engineDeps(app, newUlid()), request.params.factId);
      return { deleted: true };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.get<{ Querystring: { workspaceId: string; includeArchived?: string } }>(
    "/domains",
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
      const includeArchived = request.query.includeArchived === "true";
      const domains = await store.listDomains(workspaceId, includeArchived);
      return { workspaceId, domains };
    },
  );

  app.get<{ Params: { domainId: string }; Querystring: { workspaceId: string } }>(
    "/domains/:domainId",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const domain = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
      if (!domain) return reply.status(404).send({ error: "Domain not found" });
      return { domain };
    },
  );

  app.post("/domains", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const constraints = (body?.relationshipConstraints ??
      DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT) as RelationshipNeighborhoodConstraint;

    try {
      const domain = await createDomain(engineDeps(app, newUlid()), {
        workspaceId,
        domainKey: String(body?.domainKey ?? ""),
        name: String(body?.name ?? ""),
        ...(typeof body?.description === "string" ? { description: body.description } : {}),
        ...(Array.isArray(body?.metadataFilters)
          ? {
              metadataFilters: body.metadataFilters.filter(
                (k): k is string => typeof k === "string",
              ),
            }
          : {}),
        ...(Array.isArray(body?.observationFilters)
          ? { observationFilters: body.observationFilters as never[] }
          : {}),
        relationshipConstraints: constraints,
        ...(Array.isArray(body?.retrievalRules)
          ? { retrievalRules: body.retrievalRules as never[] }
          : {}),
      });
      return { domain };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.patch<{ Params: { domainId: string } }>("/domains/:domainId", async (request, reply) => {
    const body = request.body as Record<string, unknown> | null;
    const workspaceId = body?.workspaceId;
    if (typeof workspaceId !== "string" || !workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const existing = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
    if (!existing) return reply.status(404).send({ error: "Domain not found" });

    try {
      const domain = await updateDomain(engineDeps(app, newUlid()), request.params.domainId, {
        ...(typeof body?.name === "string" ? { name: body.name } : {}),
        ...(typeof body?.description === "string" ? { description: body.description } : {}),
        ...(Array.isArray(body?.metadataFilters)
          ? {
              metadataFilters: body.metadataFilters.filter(
                (k): k is string => typeof k === "string",
              ),
            }
          : {}),
        ...(body?.relationshipConstraints
          ? {
              relationshipConstraints:
                body.relationshipConstraints as RelationshipNeighborhoodConstraint,
            }
          : {}),
        ...(Array.isArray(body?.retrievalRules)
          ? { retrievalRules: body.retrievalRules as never[] }
          : {}),
        ...(Array.isArray(body?.observationFilters)
          ? { observationFilters: body.observationFilters as never[] }
          : {}),
      });
      return { domain };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post<{ Params: { domainId: string } }>(
    "/domains/:domainId/archive",
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

      const existing = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
      if (!existing) return reply.status(404).send({ error: "Domain not found" });

      try {
        const domain = await archiveDomain(engineDeps(app, newUlid()), request.params.domainId);
        return { domain };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.delete<{ Params: { domainId: string } }>("/domains/:domainId", async (request, reply) => {
    const workspaceId = (request.query as Record<string, string>).workspaceId;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId query parameter required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "hard_delete", { workspaceId }))) {
      return;
    }

    const existing = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
    if (!existing) return reply.status(404).send({ error: "Domain not found" });

    try {
      await deleteDomain(engineDeps(app, newUlid()), request.params.domainId);
      return { deleted: true };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.get<{ Params: { domainId: string }; Querystring: { workspaceId: string } }>(
    "/domains/:domainId/facts",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const domain = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
      if (!domain) return reply.status(404).send({ error: "Domain not found" });

      const store = createPrismaDomainEngineStore(app.prisma);
      const facts = await store.listActiveDomainFacts(request.params.domainId);
      return { domainId: request.params.domainId, facts };
    },
  );

  app.post<{ Params: { domainId: string } }>(
    "/domains/:domainId/facts",
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

      const domain = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
      if (!domain) return reply.status(404).send({ error: "Domain not found" });

      try {
        const fact = await addFact(engineDeps(app, newUlid()), {
          workspaceId,
          domainId: request.params.domainId,
          key: String(body?.key ?? ""),
          title: String(body?.title ?? ""),
          content: String(body?.content ?? ""),
          ...(typeof body?.priority === "number" ? { priority: body.priority } : {}),
          ...(Array.isArray(body?.appliesToMetadataKeys)
            ? {
                appliesToMetadataKeys: body.appliesToMetadataKeys.filter(
                  (k): k is string => typeof k === "string",
                ),
              }
            : {}),
        });
        return { fact };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.patch<{ Params: { factId: string } }>("/domain-facts/:factId", async (request, reply) => {
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
    const existing = await store.getDomainFact(request.params.factId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Domain fact not found" });
    }

    try {
      const fact = await updateFact(engineDeps(app, newUlid()), request.params.factId, {
        ...(typeof body?.title === "string" ? { title: body.title } : {}),
        ...(typeof body?.content === "string" ? { content: body.content } : {}),
        ...(typeof body?.priority === "number" ? { priority: body.priority } : {}),
        ...(Array.isArray(body?.appliesToMetadataKeys)
          ? {
              appliesToMetadataKeys: body.appliesToMetadataKeys.filter(
                (k): k is string => typeof k === "string",
              ),
            }
          : {}),
      });
      return { fact };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.post<{ Params: { factId: string } }>(
    "/domain-facts/:factId/archive",
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
      const existing = await store.getDomainFact(request.params.factId);
      if (!existing || existing.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Domain fact not found" });
      }

      try {
        const fact = await archiveFact(engineDeps(app, newUlid()), request.params.factId);
        return { fact };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.delete<{ Params: { factId: string } }>("/domain-facts/:factId", async (request, reply) => {
    const workspaceId = (request.query as Record<string, string>).workspaceId;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId query parameter required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "hard_delete", { workspaceId }))) {
      return;
    }

    const store = createPrismaDomainEngineStore(app.prisma);
    const existing = await store.getDomainFact(request.params.factId);
    if (!existing || existing.workspaceId !== workspaceId) {
      return reply.status(404).send({ error: "Domain fact not found" });
    }

    try {
      await deleteFact(engineDeps(app, newUlid()), request.params.factId);
      return { deleted: true };
    } catch (error) {
      return sendDomainEngineError(reply, error);
    }
  });

  app.get<{ Params: { domainId: string }; Querystring: { workspaceId: string } }>(
    "/domains/:domainId/instructions",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const domain = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
      if (!domain) return reply.status(404).send({ error: "Domain not found" });

      const store = createPrismaDomainEngineStore(app.prisma);
      const instructions = await store.listInstructions(request.params.domainId);
      return { domainId: request.params.domainId, instructions };
    },
  );

  app.get<{ Params: { domainId: string; actionKey: string }; Querystring: { workspaceId: string } }>(
    "/domains/:domainId/instructions/:actionKey",
    async (request, reply) => {
      const workspaceId = request.query.workspaceId;
      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }
      if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
        return;
      }
      if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

      const domain = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
      if (!domain) return reply.status(404).send({ error: "Domain not found" });

      const store = createPrismaDomainEngineStore(app.prisma);
      const instruction = await store.getActiveInstruction(
        request.params.domainId,
        request.params.actionKey,
      );
      if (!instruction) {
        return reply.status(404).send({ error: "Instruction not found" });
      }
      return { instruction };
    },
  );

  app.get<{
    Params: { domainId: string; actionKey: string };
    Querystring: { workspaceId: string };
  }>("/domains/:domainId/instructions/:actionKey/versions", async (request, reply) => {
    const workspaceId = request.query.workspaceId;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId query parameter required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const domain = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
    if (!domain) return reply.status(404).send({ error: "Domain not found" });

    const store = createPrismaDomainEngineStore(app.prisma);
    const versions = await store.listInstructions(
      request.params.domainId,
      request.params.actionKey,
    );
    return { domainId: request.params.domainId, actionKey: request.params.actionKey, versions };
  });

  app.post<{ Params: { domainId: string } }>(
    "/domains/:domainId/instructions",
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

      const domain = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
      if (!domain) return reply.status(404).send({ error: "Domain not found" });

      try {
        const instruction = await createInstruction(engineDeps(app, newUlid()), {
          workspaceId,
          domainId: request.params.domainId,
          actionKey: String(body?.actionKey ?? ""),
          title: String(body?.title ?? ""),
          content: String(body?.content ?? ""),
        });
        return { instruction };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.post<{ Params: { domainId: string; actionKey: string } }>(
    "/domains/:domainId/instructions/:actionKey/version",
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

      const domain = await loadDomainForWorkspace(app, request.params.domainId, workspaceId);
      if (!domain) return reply.status(404).send({ error: "Domain not found" });

      if (typeof body?.content !== "string" || !body.content) {
        return reply.status(400).send({ error: "content is required" });
      }

      try {
        const instruction = await versionInstruction(
          engineDeps(app, newUlid()),
          request.params.domainId,
          request.params.actionKey,
          {
            content: body.content,
            ...(typeof body?.title === "string" ? { title: body.title } : {}),
          },
        );
        return { instruction };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );

  app.post<{ Params: { instructionId: string } }>(
    "/instructions/:instructionId/archive",
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
      const existing = await store.getInstruction(request.params.instructionId);
      if (!existing || existing.workspaceId !== workspaceId) {
        return reply.status(404).send({ error: "Instruction not found" });
      }

      try {
        const instruction = await archiveInstruction(
          engineDeps(app, newUlid()),
          request.params.instructionId,
        );
        return { instruction };
      } catch (error) {
        return sendDomainEngineError(reply, error);
      }
    },
  );
}
