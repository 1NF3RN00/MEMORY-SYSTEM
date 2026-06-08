import type { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/", async () => ({
    service: "@memory-middleware/api",
    status: "running",
    health: "/health",
    workspaces: "/workspaces",
  }));

  app.get("/health", async (request) => {
    let database: "connected" | "disconnected" = "disconnected";

    try {
      await app.prisma.$queryRaw`SELECT 1`;
      database = "connected";
    } catch {
      database = "disconnected";
    }

    try {
      await app.events.emit({
        event_type: "system.health.checked",
        trace_id: request.traceId,
        metadata: { database },
      });
    } catch {
      // Health must stay available even when the event sink or DB write path fails.
    }

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
