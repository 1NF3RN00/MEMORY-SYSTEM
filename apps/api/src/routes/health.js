export async function registerHealthRoutes(app) {
    app.get("/health", async (request) => {
        let database = "disconnected";
        try {
            await app.prisma.$queryRaw `SELECT 1`;
            database = "connected";
        }
        catch {
            database = "disconnected";
        }
        await app.events.emit({
            event_type: "system.health.checked",
            trace_id: request.traceId,
            metadata: { database },
        });
        return {
            status: database === "connected" ? "ok" : "degraded",
            timestamp: new Date().toISOString(),
            trace_id: request.traceId,
            checks: {
                database,
            },
        };
    });
}
//# sourceMappingURL=health.js.map