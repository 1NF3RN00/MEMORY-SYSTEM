import type { FastifyInstance } from "fastify";

export interface SearchResultItem {
  type: "page" | "memory" | "retrieval" | "ingestion" | "compression" | "plan" | "delivery";
  id: string;
  label: string;
  subtitle: string;
  path: string;
}

export async function registerSearchRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: { q?: string; workspaceId?: string; limit?: string } }>(
    "/search",
    async (request, reply) => {
      const q = request.query.q?.trim() ?? "";
      const workspaceId = request.query.workspaceId;
      const limit = Math.min(Number(request.query.limit ?? 12), 30);

      if (!workspaceId) {
        return reply.status(400).send({ error: "workspaceId query parameter required" });
      }

      if (q.length === 0) {
        return { query: q, results: [] as SearchResultItem[] };
      }

      const [memories, retrievals, ingestions, compressions, plans, deliveries] =
        await Promise.all([
          app.prisma.memory.findMany({
            where: {
              workspaceId,
              OR: [
                { id: { contains: q, mode: "insensitive" } },
                { title: { contains: q, mode: "insensitive" } },
                { sourceType: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { updatedAt: "desc" },
            take: limit,
            select: { id: true, title: true, memoryType: true },
          }),
          app.prisma.retrievalOperation.findMany({
            where: {
              workspaceId,
              OR: [
                { traceId: { contains: q, mode: "insensitive" } },
                { query: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: { traceId: true, query: true, status: true },
          }),
          app.prisma.ingestionTrace.findMany({
            where: {
              workspaceId,
              OR: [
                { traceId: { contains: q, mode: "insensitive" } },
                { sourceType: { contains: q, mode: "insensitive" } },
                ...(q.length >= 4 ? [{ memoryId: { contains: q, mode: "insensitive" as const } }] : []),
              ],
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: { traceId: true, sourceType: true, status: true },
          }),
          app.prisma.compressionOperation.findMany({
            where: {
              workspaceId,
              OR: [
                { traceId: { contains: q, mode: "insensitive" } },
                { retrievalTraceId: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: { traceId: true, retrievalTraceId: true, status: true },
          }),
          app.prisma.retrievalPlan.findMany({
            where: {
              workspaceId,
              OR: [
                { planId: { contains: q, mode: "insensitive" } },
                { query: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: { planId: true, query: true, retrievalMode: true },
          }),
          app.prisma.contextRenderOperation.findMany({
            where: {
              workspaceId,
              OR: [
                { deliveryId: { contains: q, mode: "insensitive" } },
                { retrievalTraceId: { contains: q, mode: "insensitive" } },
              ],
            },
            orderBy: { createdAt: "desc" },
            take: limit,
            select: { deliveryId: true, retrievalTraceId: true, status: true },
          }),
        ]);

      const results: SearchResultItem[] = [
        ...memories.map((m) => ({
          type: "memory" as const,
          id: m.id,
          label: m.title || m.id,
          subtitle: `${m.memoryType} · ${m.id.slice(0, 12)}…`,
          path: `/memory/${m.id}`,
        })),
        ...retrievals.map((t) => ({
          type: "retrieval" as const,
          id: t.traceId,
          label: t.query.slice(0, 80) || t.traceId,
          subtitle: `Retrieval · ${t.status} · ${t.traceId.slice(0, 12)}…`,
          path: `/retrieval-traces/${t.traceId}`,
        })),
        ...ingestions.map((t) => ({
          type: "ingestion" as const,
          id: t.traceId,
          label: t.sourceType,
          subtitle: `Ingestion · ${t.status} · ${t.traceId.slice(0, 12)}…`,
          path: `/ingestion/${t.traceId}`,
        })),
        ...compressions.map((t) => ({
          type: "compression" as const,
          id: t.traceId,
          label: t.traceId,
          subtitle: `Compression · ${t.status}`,
          path: `/compression-traces/${t.traceId}`,
        })),
        ...plans.map((p) => ({
          type: "plan" as const,
          id: p.planId,
          label: p.query.slice(0, 80),
          subtitle: `Plan · ${p.retrievalMode}`,
          path: `/planning/${p.planId}`,
        })),
        ...deliveries.map((d) => ({
          type: "delivery" as const,
          id: d.deliveryId,
          label: d.deliveryId,
          subtitle: `Context delivery · ${d.status}`,
          path: `/context-delivery/${d.deliveryId}`,
        })),
      ];

      return { query: q, results: results.slice(0, limit) };
    },
  );
}
