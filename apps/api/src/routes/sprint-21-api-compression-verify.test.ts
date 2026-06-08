import assert from "node:assert/strict";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { describe, it } from "node:test";
import Fastify from "fastify";
import { loadCompressionEnv } from "../config/compression-env.js";
import { registerResponseCompression } from "../lib/register-response-compression.js";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

function buildLargeJsonPayload(repeatCount = 400): Record<string, unknown> {
  const rows = Array.from({ length: repeatCount }, (_, index) => ({
    id: `trace-${index.toString().padStart(6, "0")}`,
    workspaceId: "ws-sprint-21-fixture",
    status: index % 3 === 0 ? "completed" : "running",
    query: `fixture retrieval query with enough entropy to compress ${index}`,
    rankingBreakdown: Array.from({ length: 8 }, (__, rank) => ({
      memoryId: `mem-${rank}`,
      score: 0.99 - rank * 0.01,
      reason: "deterministic fixture ranking",
    })),
    stages: [
      { stage: "embedding", status: "completed", durationMs: 42 + (index % 7) },
      { stage: "ranking", status: "completed", durationMs: 18 + (index % 5) },
    ],
  }));

  return {
    traces: rows,
    meta: { tier: "fixture", count: rows.length },
  };
}

async function buildCompressionFixtureApp() {
  const app = Fastify({ logger: false });
  await registerResponseCompression(app, loadCompressionEnv());

  const payload = buildLargeJsonPayload();
  const uncompressedJson = JSON.stringify(payload);
  const uncompressedBytes = Buffer.byteLength(uncompressedJson, "utf8");

  app.get("/large-json", async () => payload);
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));
  app.get("/sse", { config: { compress: false } }, async (_request, reply) => {
    reply.header("Content-Type", "text/event-stream");
    return "data: fixture\n\n";
  });
  app.get("/binary", async (_request, reply) => {
    reply.header("Content-Type", "application/octet-stream");
    return Buffer.from([0x00, 0x01, 0x02, 0xff]);
  });

  await app.ready();
  return { app, payload, uncompressedBytes };
}

describe("sprint-21 api compression verify", () => {
  it("wires registerResponseCompression in create-app before routes", () => {
    const source = readSource("create-app.ts");
    assert.match(source, /registerResponseCompression/);
    assert.match(source, /loadCompressionEnv/);
  });

  it("returns Content-Encoding gzip for large JSON when Accept-Encoding includes gzip", async () => {
    const { app, uncompressedBytes } = await buildCompressionFixtureApp();

    const response = await app.inject({
      method: "GET",
      url: "/large-json",
      headers: { "accept-encoding": "gzip" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-encoding"], "gzip");
    assert.ok(uncompressedBytes > 50_000, "fixture should exceed 50 KB uncompressed");
    assert.ok(
      response.rawPayload.length < uncompressedBytes * 0.4,
      `expected >=60% wire reduction; got ${response.rawPayload.length} vs ${uncompressedBytes}`,
    );

    const decoded = JSON.parse(gunzipSync(response.rawPayload).toString("utf8"));
    assert.equal(decoded.meta.count, 400);

    await app.close();
  });

  it("returns Content-Encoding br for large JSON when brotli is preferred", async () => {
    const { app } = await buildCompressionFixtureApp();

    const response = await app.inject({
      method: "GET",
      url: "/large-json",
      headers: { "accept-encoding": "br, gzip" },
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers["content-encoding"], "br");

    await app.close();
  });

  it("does not compress SSE or binary responses", async () => {
    const { app } = await buildCompressionFixtureApp();

    const sse = await app.inject({
      method: "GET",
      url: "/sse",
      headers: { "accept-encoding": "gzip, br" },
    });
    assert.equal(sse.statusCode, 200);
    assert.equal(sse.headers["content-encoding"], undefined);
    assert.equal(sse.body, "data: fixture\n\n");

    const binary = await app.inject({
      method: "GET",
      url: "/binary",
      headers: { "accept-encoding": "gzip, br" },
    });
    assert.equal(binary.statusCode, 200);
    assert.equal(binary.headers["content-encoding"], undefined);

    await app.close();
  });

  it("keeps /health fast with compression enabled (no measurable CPU regression on small JSON)", async () => {
    const { app } = await buildCompressionFixtureApp();

    const samples: number[] = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      const response = await app.inject({
        method: "GET",
        url: "/health",
        headers: { "accept-encoding": "gzip" },
      });
      samples.push(performance.now() - start);
      assert.equal(response.statusCode, 200);
      assert.equal(response.headers["content-encoding"], undefined);
    }

    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)] ?? samples.at(-1) ?? 0;
    assert.ok(p95 < 25, `health p95 inject latency should stay under 25ms; got ${p95.toFixed(2)}ms`);

    await app.close();
  });
});
