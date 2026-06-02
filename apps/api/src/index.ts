import { createApiRuntime, resolveListenPort } from "./bootstrap.js";
import { disconnectDatabase } from "./lib/database.js";

async function main(): Promise<void> {
  const { env, logger, prisma, events, app } = await createApiRuntime();

  logger.info(
    {
      host: env.API_HOST,
      port: resolveListenPort(env),
      vercel: process.env.VERCEL === "1",
    },
    "api.startup",
  );

  await events.emit({
    event_type: "system.startup",
    trace_id: "system",
    metadata: { service: "api" },
  });

  await app.listen({
    host: env.API_HOST,
    port: resolveListenPort(env),
  });

  logger.info(
    {
      host: env.API_HOST,
      port: resolveListenPort(env),
    },
    "api.listening",
  );

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "api.shutdown");
    await app.close();
    await disconnectDatabase(logger);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error: unknown) => {
  console.error("api.startup_failed", error);
  process.exit(1);
});
