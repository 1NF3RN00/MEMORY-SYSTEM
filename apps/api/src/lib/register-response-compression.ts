import compress from "@fastify/compress";
import type { FastifyInstance } from "fastify";
import type { CompressionEnv } from "../config/compression-env.js";

/**
 * Registers gzip/deflate/brotli for JSON and other compressible responses.
 * Skips incompressible types (e.g. text/event-stream, application/octet-stream)
 * via the `compressible` content-type check inside @fastify/compress.
 */
export async function registerResponseCompression(
  app: FastifyInstance,
  env: CompressionEnv,
): Promise<void> {
  if (!env.API_COMPRESSION_ENABLED) {
    return;
  }

  await app.register(compress, {
    global: true,
    threshold: env.API_COMPRESSION_THRESHOLD_BYTES,
    encodings: ["br", "gzip", "deflate"],
  });
}
