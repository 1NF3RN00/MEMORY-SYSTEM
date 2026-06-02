import { getIngestionTrace, getSourceTruth } from "../lib/ingestion-store.js";
export async function registerIngestionRoutes(app) {
    app.get("/ingestion", async (request) => {
        const limit = Math.min(Number(request.query.limit ?? 50), 100);
        const traces = await app.prisma.ingestionTrace.findMany({
            where: request.query.workspaceId
                ? { workspaceId: request.query.workspaceId }
                : undefined,
            orderBy: { createdAt: "desc" },
            take: limit,
        });
        return {
            traces: traces.map((t) => ({
                traceId: t.traceId,
                workspaceId: t.workspaceId,
                memoryId: t.memoryId,
                status: t.status,
                sourceType: t.sourceType,
                createdAt: t.createdAt.toISOString(),
                updatedAt: t.updatedAt.toISOString(),
            })),
        };
    });
    app.get("/ingestion/:traceId", async (request, reply) => {
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
    app.get("/events/:traceId", async (request, reply) => {
        const events = await app.prisma.eventLog.findMany({
            where: { traceId: request.params.traceId },
            orderBy: { timestamp: "asc" },
        });
        return {
            traceId: request.params.traceId,
            events: events.map((event) => {
                const payload = event.payload;
                const metadata = (payload.metadata ?? {});
                return {
                    eventId: event.id,
                    eventType: event.eventType,
                    timestamp: event.timestamp.toISOString(),
                    severity: event.severity,
                    success: metadata.success !== false,
                    latencyMs: metadata.latency_ms,
                    memoryId: metadata.memory_id,
                    metadata,
                };
            }),
        };
    });
}
//# sourceMappingURL=ingestion.js.map