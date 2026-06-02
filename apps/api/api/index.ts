import type { IncomingMessage, ServerResponse } from "node:http";
import { createApiRuntime } from "../src/bootstrap.js";

let runtimePromise: ReturnType<typeof createApiRuntime> | undefined;

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  runtimePromise ??= createApiRuntime();
  const { app } = await runtimePromise;
  await app.ready();
  app.server.emit("request", req, res);
}
