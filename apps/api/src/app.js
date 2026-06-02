import { registerRoutes } from "./routes/index.js";
export async function buildApp(deps) {
    const Fastify = (await import("fastify")).default;
    const app = Fastify({
        logger: false,
        disableRequestLogging: true,
    });
    app.addHook("onRequest", async (request, reply) => {
        reply.header("Access-Control-Allow-Origin", "*");
        reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
        reply.header("Access-Control-Allow-Headers", "Content-Type, x-trace-id");
        if (request.method === "OPTIONS") {
            return reply.status(204).send();
        }
    });
    const { registerRequestLogging } = await import("@memory-middleware/observability");
    await registerRequestLogging(app, {
        logger: deps.logger,
        traceHeader: deps.traceHeader,
    });
    app.decorate("prisma", deps.prisma);
    app.decorate("events", deps.events);
    app.decorate("appLogger", deps.logger);
    app.decorate("traceHeader", deps.traceHeader);
    await registerRoutes(app);
    return app;
}
//# sourceMappingURL=app.js.map