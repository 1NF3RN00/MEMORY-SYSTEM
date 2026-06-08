import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateByEndpoint,
  AUDIT_REFERENCE,
  buildTelemetryPaths,
  classifyPayloadTier,
  endpointPattern,
  type RequestMeasurement,
} from "./benchmark-dashboard-load.js";
import { sanitizeHar, summarizeHar, type HarLog } from "./benchmark-dashboard-har-sanitize.js";

describe("benchmark-dashboard-load helpers", () => {
  it("builds telemetry paths aligned with fetchWorkspaceTelemetry", () => {
    const paths = buildTelemetryPaths("01TESTWORKSPACE000000000000");
    assert.equal(paths.length, 9);
    assert.ok(paths.some((p) => p.includes("/diagnostics/operational") && p.includes("mode=slim")));
    assert.ok(paths.some((p) => p.endsWith("/health")));
    assert.ok(!paths.some((p) => p.includes("/ranking")));
  });

  it("normalizes endpoint patterns for aggregation", () => {
    assert.equal(
      endpointPattern("/memory?workspaceId=abc&limit=100"),
      "/memory?workspaceId=:ws&limit=100",
    );
    assert.equal(
      endpointPattern("/compression/01ARZ3NDEKTSV4RRFFQ69G5FAV?summary=true"),
      "/compression/:id?summary=true",
    );
  });

  it("aggregates bytes and durations by endpoint pattern", () => {
    const requests: RequestMeasurement[] = [
      {
        phase: "telemetry_parallel",
        method: "GET",
        path: "/memory?workspaceId=ws1&limit=100",
        status: 200,
        responseBytes: 1000,
        durationMs: 50,
        error: null,
      },
      {
        phase: "telemetry_parallel",
        method: "GET",
        path: "/memory?workspaceId=ws1&limit=100",
        status: 200,
        responseBytes: 1200,
        durationMs: 70,
        error: null,
      },
      {
        phase: "graph",
        method: "GET",
        path: "/relationships/graph?workspaceId=ws1&lite=true",
        status: 200,
        responseBytes: 5000,
        durationMs: 120,
        error: null,
      },
    ];

    const aggregates = aggregateByEndpoint(requests);
    const memory = aggregates.find((a) => a.pathPattern.startsWith("/memory"));
    const graph = aggregates.find((a) => a.pathPattern.startsWith("/relationships/graph"));
    assert.ok(memory);
    assert.ok(graph);
    assert.equal(memory!.totalBytes, 2200);
    assert.equal(memory!.count, 2);
    assert.equal(graph!.maxDurationMs, 120);
  });

  it("classifies payload tiers using audit reference ranges", () => {
    assert.equal(classifyPayloadTier(10), "empty");
    assert.equal(classifyPayloadTier(500), "moderate");
    assert.equal(classifyPayloadTier(3000), "heavy");
    assert.equal(classifyPayloadTier(9000), "worst");
    assert.ok(AUDIT_REFERENCE.strictModeNote.includes("StrictMode"));
  });
});

describe("benchmark-dashboard-har-sanitize", () => {
  it("redacts sensitive headers and query tokens", () => {
    const har: HarLog = {
      log: {
        entries: [
          {
            request: {
              url: "http://localhost:3000/auth/me?token=secret-value",
              headers: [
                { name: "Authorization", value: "Bearer abc123" },
                { name: "Accept", value: "application/json" },
              ],
              postData: { text: '{"password":"x"}' },
            },
            response: {
              headers: [{ name: "Set-Cookie", value: "session=abc" }],
              bodySize: 512,
            },
          },
        ],
      },
    };

    const sanitized = sanitizeHar(har);
    const entry = sanitized.log.entries[0]!;
    assert.ok(entry.request!.url!.includes("token="));
    assert.ok(entry.request!.url!.includes("REDACTED"));
    assert.equal(entry.request!.headers!.find((h) => h.name === "Authorization")!.value, "[REDACTED]");
    assert.equal(entry.request!.postData!.text, "[REDACTED]");
    assert.equal(
      entry.response!.headers!.find((h) => h.name === "Set-Cookie")!.value,
      "[REDACTED]",
    );
  });

  it("summarizes API entry counts and response bytes", () => {
    const har: HarLog = {
      log: {
        entries: [
          {
            request: { url: "http://localhost:5173/assets/app.js" },
            response: { bodySize: 100_000 },
          },
          {
            request: { url: "http://localhost:3000/retrieval?workspaceId=ws" },
            response: { bodySize: 2048 },
          },
          {
            request: { url: "http://localhost:3000/health" },
            response: { bodySize: 64 },
          },
        ],
      },
    };

    const summary = summarizeHar(har);
    assert.equal(summary.entryCount, 3);
    assert.equal(summary.apiEntryCount, 2);
    assert.equal(summary.totalResponseBytes, 102_112);
    assert.deepEqual(summary.paths, ["/retrieval", "/health"]);
  });
});
