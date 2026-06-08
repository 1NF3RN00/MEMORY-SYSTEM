import { loadEnv } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./lib/database.js";
import { createPrismaEventSink } from "./lib/event-sink.js";
import { expireTemporaryMemories, processNextIngestionJob } from "./lib/job-processor.js";
import {
  createLogger,
  createLoggingEventEmitter,
} from "@memory-middleware/observability";

async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger({
    level: env.LOG_LEVEL,
    service: "worker",
    baseContext: { environment: env.NODE_ENV },
  });

  const prisma = await connectDatabase(logger);
  const events = createLoggingEventEmitter({
    logger,
    sink: createPrismaEventSink(prisma),
  });

  logger.info({ pollIntervalMs: env.WORKER_POLL_INTERVAL_MS }, "worker.started");

  let running = true;

  const tick = async () => {
    if (!running) return;

    try {
      const processed = await processNextIngestionJob({
        prisma,
        events,
        logger,
        ...(env.OPENAI_API_KEY ? { openAiApiKey: env.OPENAI_API_KEY } : {}),
      });

      if (!processed) {
        await expireTemporaryMemories(prisma, events);
      }
    } catch (error) {
      logger.error({ error }, "worker.tick.error");
    }
  };

  const interval = setInterval(() => void tick(), env.WORKER_POLL_INTERVAL_MS);
  await tick();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker.shutdown");
    running = false;
    clearInterval(interval);
    await disconnectDatabase(logger);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
