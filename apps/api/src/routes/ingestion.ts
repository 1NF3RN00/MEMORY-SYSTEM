import type { FastifyInstance } from "fastify";
import { getIngestionTrace, getSourceTruth } from "../lib/ingestion-store.js";
import {
  parseListFieldsQuery,
  projectListRows,
} from "../lib/list-field-projection.js";

export async function registerIngestionRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { workspaceId?: string; limit?: string; fields?: string } }>(
    "/ingestion",
    async (request, reply) => {
      const fieldProjection = parseListFieldsQuery("ingestion", request.query.fields);
      if (!fieldProjection.ok) {
        return reply.status(400).send({
          error: fieldProjection.error,
          invalidFields: fieldProjection.invalidFields,
        });
      }

      const limit = Math.min(Number(request.query.limit ?? 50), 100);
      const traces = await app.prisma.ingestionTrace.findMany({
        ...(request.query.workspaceId
          ? { where: { workspaceId: request.query.workspaceId } }
          : {}),
        orderBy: { createdAt: "desc" },
        take: limit,
      });

      const rows = traces.map((t) => ({
        traceId: t.traceId,
        workspaceId: t.workspaceId,
        memoryId: t.memoryId,
        status: t.status,
        sourceType: t.sourceType,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      }));

      return { traces: projectListRows(rows, fieldProjection.fields) };
    },
  );

  app.get<{ Params: { traceId: string } }>("/ingestion/:traceId", async (request, reply) => {
    const trace = await getIngestionTrace(app.prisma, request.params.traceId);

    if (!trace) {
      return reply.status(404).send({ error: "Ingestion trace not found" });
    }

    const sourceTruth = await getSourceTruth(app.prisma, request.params.traceId);

    return {
      trace,
      sourceTruth,
    };
  });

  app.get<{ Params: { traceId: string } }>("/events/:traceId", async (request, reply) => {
    const events = await app.prisma.eventLog.findMany({
      where: { traceId: request.params.traceId },
      orderBy: { timestamp: "asc" },
    });

    return {
      traceId: request.params.traceId,
      events: events.map((event) => {
        const payload = event.payload as Record<string, unknown>;
        const metadata = (payload.metadata ?? {}) as Record<string, unknown>;

        return {
          eventId: event.id,
          eventType: event.eventType,
          timestamp: event.timestamp.toISOString(),
          severity: event.severity,
          success: metadata.success !== false,
          latencyMs: metadata.latency_ms as number | undefined,
          memoryId: metadata.memory_id as string | undefined,
          metadata,
        };
      }),
    };
  });
}
