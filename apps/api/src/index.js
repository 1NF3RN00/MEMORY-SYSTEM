import { loadEnv } from "./config/env.js";
import { buildApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./lib/database.js";
import { createPrismaEventSink } from "./lib/event-sink.js";
import { createLogger, createLoggingEventEmitter, } from "@memory-middleware/observability";
async function main() {
    const env = loadEnv();
    const logger = createLogger({
        level: env.LOG_LEVEL,
        service: "api",
        baseContext: { environment: env.NODE_ENV },
    });
    logger.info({
        host: env.API_HOST,
        port: env.API_PORT,
    }, "api.startup");
    const prisma = await connectDatabase(logger);
    const events = createLoggingEventEmitter({
        logger,
        sink: createPrismaEventSink(prisma),
    });
    await events.emit({
        event_type: "system.startup",
        trace_id: "system",
        metadata: { service: "api" },
    });
    const app = await buildApp({
        logger,
        prisma,
        events,
        traceHeader: env.TRACE_HEADER,
    });
    await app.listen({
        host: env.API_HOST,
        port: env.API_PORT,
    });
    logger.info({
        host: env.API_HOST,
        port: env.API_PORT,
    }, "api.listening");
    const shutdown = async (signal) => {
        logger.info({ signal }, "api.shutdown");
        await app.close();
        await disconnectDatabase(logger);
        process.exit(0);
    };
    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));
}
main().catch((error) => {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=index.js.map