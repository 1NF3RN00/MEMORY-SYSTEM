import type { FastifyInstance } from "fastify";
import type { RelationshipGenerationRequest } from "@memory-middleware/shared-types";
import { RELATIONSHIP_EVENT_TYPES } from "@memory-middleware/shared-types";
import {
  getAugmentationTrace,
  getEnhancedMemoryRelationships,
  getMemoryNeighborhood,
  getWorkspaceClusters,
  runRelationshipGeneration,
} from "../lib/relationship-store.js";

export async function registerRelationshipRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { memoryId: string }; Querystring: { workspaceId?: string } }>(
    "/relationships/:memoryId",
    async (request, reply) => {
      const view = await getEnhancedMemoryRelationships(
        app.prisma,
        request.params.memoryId,
        request.query.workspaceId,
      );

      if (!view) {
        return reply.status(404).send({ error: "Memory not found" });
      }

      return view;
    },
  );

  app.get<{
    Params: { memoryId: string };
    Querystring: { workspaceId?: string; confidenceThreshold?: string; maxNeighbors?: string };
  }>("/relationships/:memoryId/neighborhood", async (request, reply) => {
    const neighborhood = await getMemoryNeighborhood(
      app.prisma,
      request.params.memoryId,
      request.query.workspaceId,
      {
        ...(request.query.confidenceThreshold
          ? { confidenceThreshold: Number(request.query.confidenceThreshold) }
          : {}),
        ...(request.query.maxNeighbors
          ? { maxNeighbors: Number(request.query.maxNeighbors) }
          : {}),
      },
    );

    if (!neighborhood) {
      return reply.status(404).send({ error: "Memory not found" });
    }

    await app.events.emit({
      event_type: RELATIONSHIP_EVENT_TYPES.NEIGHBORHOOD_EXPANDED,
      trace_id: request.params.memoryId,
      workspace_id: neighborhood.workspaceId,
      metadata: {
        anchor_memory_id: request.params.memoryId,
        neighbor_count: neighborhood.nodes.length,
      },
    });

    return neighborhood;
  });

  app.post<{ Body: RelationshipGenerationRequest }>(
    "/relationships/generate",
    async (request, reply) => {
      const body = request.body;
      if (!body?.workspaceId) {
        return reply.status(400).send({ error: "workspaceId required" });
      }

      const result = await runRelationshipGeneration(app.prisma, body);
      if (!result) {
        return reply.status(404).send({ error: "Workspace or memory not found" });
      }

      await app.events.emit({
        event_type: RELATIONSHIP_EVENT_TYPES.RELATIONSHIP_GENERATED,
        trace_id: body.memoryId ?? body.workspaceId,
        workspace_id: body.workspaceId,
        metadata: {
          generated: result.generated,
          updated: result.updated,
        },
      });

      return result;
    },
  );

  app.get<{ Params: { workspaceId: string } }>(
    "/clusters/:workspaceId",
    async (request, reply) => {
      const clusters = await getWorkspaceClusters(app.prisma, request.params.workspaceId);
      if (!clusters) {
        return reply.status(404).send({ error: "Workspace not found" });
      }

      await app.events.emit({
        event_type: RELATIONSHIP_EVENT_TYPES.CLUSTER_GENERATED,
        trace_id: request.params.workspaceId,
        workspace_id: request.params.workspaceId,
        metadata: {
          cluster_count: clusters.stats.clusterCount,
        },
      });

      return clusters;
    },
  );

  app.get<{ Params: { traceId: string } }>(
    "/augmentation/:traceId",
    async (request, reply) => {
      const view = await getAugmentationTrace(app.prisma, request.params.traceId);
      if (!view) {
        return reply.status(404).send({ error: "Retrieval trace not found" });
      }

      return view;
    },
  );
}
