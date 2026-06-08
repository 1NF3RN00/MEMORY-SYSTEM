import type { FastifyInstance } from "fastify";

import { mapMemoryRow } from "../lib/memory-mapper.js";
import {
  evaluateAndArchiveEligible,
  getMemoryAdjacency,
  getMemoryEvolution,
  getMemoryStructure,
  reinforceMemoryRecord,
} from "../lib/memory-evolution.js";

import { archiveMemory, deleteMemory } from "../lib/memory-lifecycle.js";
import {
  parseListFieldsQuery,
  projectListRows,
} from "../lib/list-field-projection.js";

export async function registerMemoryRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      workspaceId?: string;
      limit?: string;
      includeArchived?: string;
      fields?: string;
    };
  }>(
    "/memory",
    async (request, reply) => {
      if (!request.query.workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      const fieldProjection = parseListFieldsQuery("memory", request.query.fields);
      if (!fieldProjection.ok) {
        return reply.status(400).send({
          error: fieldProjection.error,
          invalidFields: fieldProjection.invalidFields,
        });
      }

      const limit = Math.min(Number(request.query.limit ?? 50), 100);
      const includeArchived = request.query.includeArchived === "true";

      const memories = await app.prisma.memory.findMany({
        where: {
          workspaceId: request.query.workspaceId,
          ...(includeArchived ? {} : { archived: false }),
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        include: {
          _count: { select: { chunks: true } },
        },
      });

      const rows = memories.map((m) => ({
        id: m.id,
        title: m.title,
        memoryType: m.memoryType,
        sourceType: m.sourceType,
        persistenceMode: m.persistenceMode,
        archived: m.archived,
        retrievalEligible: m.retrievalEligible,
        ingestionStatus: m.ingestionStatus,
        chunkCount: m._count.chunks,
        createdAt: m.createdAt.toISOString(),
        ...(m.archivedAt ? { archivedAt: m.archivedAt.toISOString() } : {}),
      }));

      return {
        workspaceId: request.query.workspaceId,
        memories: projectListRows(rows, fieldProjection.fields),
      };
    },
  );

  app.get<{ Params: { id: string } }>("/memory/:id", async (request, reply) => {

    const memory = await app.prisma.memory.findUnique({

      where: { id: request.params.id },

      include: { chunks: true },

    });



    if (!memory) {

      return reply.status(404).send({ error: "Memory not found" });

    }



    return { memory: mapMemoryRow(memory, memory.chunks) };

  });



  app.get<{ Params: { id: string } }>("/memory/:id/chunks", async (request, reply) => {

    const memory = await app.prisma.memory.findUnique({

      where: { id: request.params.id },

    });



    if (!memory) {

      return reply.status(404).send({ error: "Memory not found" });

    }



    const chunks = await app.prisma.memoryChunk.findMany({

      where: { memoryId: request.params.id },

      orderBy: { sequence: "asc" },

    });



    const mapped = mapMemoryRow(memory, chunks);



    return {

      memoryId: memory.id,

      chunks: mapped.chunks,

    };

  });



  app.post<{ Params: { id: string } }>("/memory/:id/archive", async (request, reply) => {

    const body = (request.body ?? {}) as Record<string, unknown>;

    const reason = typeof body.reason === "string" ? body.reason : "manual_archive";
    const lifecycleArchive = body.lifecycleArchive === true;



    if (lifecycleArchive) {

      const result = await evaluateAndArchiveEligible(

        app.prisma,

        app.events,

        request.params.id,

        reason,

      );



      if ("error" in result) {

        return reply.status(result.status).send({ error: result.error });

      }



      if (result.archived) {

        return {

          memoryId: request.params.id,

          action: "archive",

          archived: true,

          reason: result.reason,

          message: "Memory archived via lifecycle eligibility transition.",

        };

      }

    }



    const result = await archiveMemory(

      app.prisma,

      app.events,

      request.params.id,

      reason,

    );



    if ("error" in result) {

      return reply.status(result.status).send({ error: result.error });

    }



    return result;

  });



  app.get<{ Params: { id: string } }>("/memory/:id/structure", async (request, reply) => {

    const result = await getMemoryStructure(app.prisma, request.params.id);

    if ("error" in result) {

      return reply.status(result.status).send({ error: result.error });

    }

    return { structure: result };

  });



  app.get<{ Params: { id: string } }>("/memory/:id/evolution", async (request, reply) => {

    const result = await getMemoryEvolution(app.prisma, request.params.id);

    if ("error" in result) {

      return reply.status(result.status).send({ error: result.error });

    }

    return { evolution: result };

  });



  app.get<{ Params: { id: string } }>("/memory/:id/adjacency", async (request, reply) => {

    const result = await getMemoryAdjacency(app.prisma, request.params.id);

    if ("error" in result) {

      return reply.status(result.status).send({ error: result.error });

    }

    return { adjacency: result };

  });



  app.post<{ Params: { id: string } }>("/memory/:id/reinforce", async (request, reply) => {

    const body = (request.body ?? {}) as Record<string, unknown>;

    const reason = typeof body.reason === "string" ? body.reason : "api_reinforce";

    const contextualUsefulness =

      typeof body.contextualUsefulness === "number" ? body.contextualUsefulness : undefined;



    const result = await reinforceMemoryRecord(

      app.prisma,

      app.events,

      request.params.id,

      contextualUsefulness,

      reason,

    );



    if ("error" in result) {

      return reply.status(result.status).send({ error: result.error });

    }



    return result;

  });



  app.delete<{ Params: { id: string } }>("/memory/:id", async (request, reply) => {

    const body = (request.body ?? {}) as Record<string, unknown>;



    if (body.confirm !== true) {

      return reply.status(400).send({

        error: 'Full delete requires { "confirm": true } in the request body',

      });

    }



    const reason = typeof body.reason === "string" ? body.reason : "manual_delete";



    const result = await deleteMemory(

      app.prisma,

      app.events,

      request.params.id,

      reason,

    );



    if ("error" in result) {

      return reply.status(result.status).send({ error: result.error });

    }



    return result;

  });

}


