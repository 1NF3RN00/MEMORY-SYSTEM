import type { IncomingMessage, ServerResponse } from "node:http";
import { createApiRuntime, resolveListenPort } from "./bootstrap.js";
import { disconnectDatabase } from "./lib/database.js";

let runtimePromise: ReturnType<typeof createApiRuntime> | undefined;

async function getRuntime(): Promise<Awaited<ReturnType<typeof createApiRuntime>>> {
  runtimePromise ??= createApiRuntime();
  return runtimePromise;
}

/** Vercel serverless + compatible local `vercel dev` */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const { app } = await getRuntime();
  await app.ready();
  app.server.emit("request", req, res);
}

async function startLocalServer(): Promise<void> {
  const { env, logger, events, app } = await getRuntime();

  logger.info(
    {
      host: env.API_HOST,
      port: resolveListenPort(env),
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

if (!process.env.VERCEL) {
  startLocalServer().catch((error: unknown) => {
    console.error("api.startup_failed", error);
    process.exit(1);
  });
}
