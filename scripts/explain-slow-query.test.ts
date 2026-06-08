import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  parseArgs,
  resolveSqlInput,
  type ExplainSlowQueryReport,
} from "./explain-slow-query-args.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

describe("explain-slow-query script", () => {
  it("parses CLI args for sql, file, output, and analyze mode", () => {
    const args = parseArgs([
      "--sql",
      "SELECT 1",
      "--output",
      "runs/out.json",
      "--no-analyze",
    ]);
    assert.equal(args.sql, "SELECT 1");
    assert.equal(args.output, "runs/out.json");
    assert.equal(args.analyze, false);
  });

  it("resolves sql from --sql input", () => {
    const resolved = resolveSqlInput({ sql: "SELECT 2", analyze: true });
    assert.equal(resolved.sql, "SELECT 2");
    assert.equal(resolved.source, "cli");
  });

  it("builds report shape with OP-25 audit refs", () => {
    const report: ExplainSlowQueryReport = {
      generatedAt: "2026-06-08T00:00:00.000Z",
      auditRefs: { findingIds: ["OP-25"], sprint: "sprint-26-explain-analyze-automation" },
      input: { sqlFingerprint: "abc123", analyze: true, source: "cli" },
      capture: null,
    };
    assert.deepEqual(report.auditRefs.findingIds, ["OP-25"]);
  });

  it("main script references observability explain helpers and OP-25", () => {
    const source = readFileSync(join(__dirname, "explain-slow-query.ts"), "utf8");
    assert.match(source, /@memory-middleware\/observability/);
    assert.match(source, /runExplainCapture/);
    assert.match(source, /OP-25/);
  });
});
