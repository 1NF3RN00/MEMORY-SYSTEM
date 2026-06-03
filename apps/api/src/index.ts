import type { IncomingMessage, ServerResponse } from "node:http";
import Fastify from "fastify";
import { createApiRuntime, resolveListenPort } from "./bootstrap.js";
import { disconnectDatabase } from "./lib/database.js";

// Referenced so the entry file statically imports Fastify (required by Vercel).
void Fastify;

type ApiRuntime = Awaited<ReturnType<typeof createApiRuntime>>;

let runtimePromise: Promise<ApiRuntime> | null = null;
let startupEventEmitted = false;

function loadRuntime(): Promise<ApiRuntime> {
  runtimePromise ??= createApiRuntime();
  return runtimePromise;
}

async function emitStartupOnce(runtime: ApiRuntime): Promise<void> {
  if (startupEventEmitted) return;
  startupEventEmitted = true;
  try {
    await runtime.events.emit({
      event_type: "system.startup",
      trace_id: "system",
      metadata: { service: "api" },
    });
  } catch (error) {
    runtime.logger.warn(
      {
        err: error,
        hint: "Run npm run db:migrate:deploy against this database (see docs/ENVIRONMENT.md)",
      },
      "api.startup_event_skipped",
    );
  }
}

/** Vercel / serverless entry — routes must be registered before ready(). */
export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const runtime = await loadRuntime();
  await emitStartupOnce(runtime);
  await runtime.app.ready();
  runtime.app.server.emit("request", req, res);
}

function isLocalServer(): boolean {
  return !process.env.VERCEL && !process.env.AWS_LAMBDA_FUNCTION_NAME;
}

async function main(): Promise<void> {
  const runtime = await loadRuntime();

  runtime.logger.info(
    {
      host: runtime.env.API_HOST,
      port: resolveListenPort(runtime.env),
    },
    "api.startup",
  );

  await emitStartupOnce(runtime);

  await runtime.app.listen({
    host: runtime.env.API_HOST,
    port: resolveListenPort(runtime.env),
  });

  runtime.logger.info(
    {
      host: runtime.env.API_HOST,
      port: resolveListenPort(runtime.env),
    },
    "api.listening",
  );

  const shutdown = async (signal: string) => {
    runtime.logger.info({ signal }, "api.shutdown");
    await runtime.app.close();
    await disconnectDatabase(runtime.logger);
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

if (isLocalServer()) {
  main().catch((error: unknown) => {
    console.error("api.startup_failed", error);
    process.exit(1);
  });
}
