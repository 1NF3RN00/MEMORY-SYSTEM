import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = here;

function readRouteSource(fileName: string): string {
  return readFileSync(join(routesDir, fileName), "utf8");
}

/** Major pipeline routes that must propagate timingCollector and return timingAudit. */
const MAJOR_PIPELINE_ROUTES = [
  {
    file: "retrieval.ts",
    handler: "POST /retrieve",
    patterns: [/runWithTimingAsync\(/, /timingAudit:\s*request\.timingCollector\.toAudit\(\)/],
  },
  {
    file: "planning.ts",
    handler: "POST /retrieval/plan",
    patterns: [/runWithTimingAsync\(/, /timingAudit:\s*request\.timingCollector\.toAudit\(\)/],
  },
  {
    file: "compression.ts",
    handler: "POST /compress",
    patterns: [
      /runWithTimingAsync\(/,
      /timingCollector:\s*request\.timingCollector/,
      /timingAudit:\s*request\.timingCollector\.toAudit\(\)/,
    ],
  },
  {
    file: "context.ts",
    handler: "POST /context/render",
    patterns: [
      /runWithTimingAsync\(/,
      /timingCollector:\s*request\.timingCollector/,
      /timingAudit:\s*request\.timingCollector\.toAudit\(\)/,
    ],
  },
] as const;

/** Graph traversal routes timed at the route boundary. */
const GRAPH_TRAVERSAL_ROUTES = [
  { file: "relationships.ts", pattern: /measureAsync\(\s*["']graph_traversal["']/ },
  { file: "compression.ts", pattern: /measureAsync\(\s*["']graph_traversal["']/ },
] as const;

describe("sprint-36 execution timing completion", () => {
  for (const route of MAJOR_PIPELINE_ROUTES) {
    it(`${route.file} wires ${route.handler} with timingAudit`, () => {
      const source = readRouteSource(route.file);
      for (const pattern of route.patterns) {
        assert.match(source, pattern, `${route.file} missing ${pattern}`);
      }
    });
  }

  for (const route of GRAPH_TRAVERSAL_ROUTES) {
    it(`${route.file} measures graph_traversal`, () => {
      const source = readRouteSource(route.file);
      assert.match(source, route.pattern);
    });
  }

  it("context-delivery pipeline accepts timingCollector and records context_rendering", () => {
    const pipelineSource = readFileSync(
      join(
        here,
        "..",
        "..",
        "..",
        "..",
        "packages",
        "context-delivery",
        "src",
        "pipeline.ts",
      ),
      "utf8",
    );
    assert.match(pipelineSource, /timingCollector\?: ExecutionTimingCollector/);
    assert.match(pipelineSource, /measurePipelineStage\(deliveryId, "context_rendering"/);
  });

  it("request-timing middleware records api_handler per route", () => {
    const timingSource = readFileSync(
      join(
        here,
        "..",
        "..",
        "..",
        "..",
        "packages",
        "observability",
        "src",
        "middleware",
        "request-timing.ts",
      ),
      "utf8",
    );
    assert.match(timingSource, /api_handler:/);
    assert.match(timingSource, /handlerStage\(request\)/);
  });

  it("documents intentional timing gaps for non-pipeline routes", () => {
    const routeFiles = readdirSync(routesDir).filter((name) => name.endsWith(".ts") && !name.includes(".test."));
    const withoutTimingWrap = routeFiles.filter((file) => {
      const source = readRouteSource(file);
      return !/runWithTimingAsync|measureAsync\(/.test(source);
    });

    const expectedGaps = new Set([
      "health.ts",
      "perf-trigger.ts",
      "access.ts",
      "auth.ts",
      "platform.ts",
      "workspaces.ts",
      "search.ts",
      "ingest.ts",
      "ingestion.ts",
      "memory.ts",
      "historian.ts",
      "diagnostics.ts",
      "domains.ts",
      "objects.ts",
      "packages.ts",
      "observations.ts",
      "observation-providers.ts",
      "workflows.ts",
      "index.ts",
      "relationships.ts",
    ]);

    for (const file of withoutTimingWrap) {
      assert.ok(
        expectedGaps.has(file),
        `${file} has no timing wrap but is not listed as an intentional gap`,
      );
    }
  });
});
