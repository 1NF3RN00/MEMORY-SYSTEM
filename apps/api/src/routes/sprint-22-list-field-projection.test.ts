import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import {
  LIST_FIELD_ALLOWLISTS,
  parseListFieldsQuery,
  projectListRows,
} from "../lib/list-field-projection.js";

const routesDir = dirname(fileURLToPath(import.meta.url));

function readRoute(name: string): string {
  return readFileSync(join(routesDir, name), "utf8");
}

describe("sprint-22 list field projection routes", () => {
  it("list routes wire parseListFieldsQuery and projectListRows", () => {
    for (const file of ["memory.ts", "retrieval.ts", "ingestion.ts", "compression.ts", "context.ts"]) {
      const source = readRoute(file);
      assert.match(source, /parseListFieldsQuery/);
      assert.match(source, /projectListRows/);
      assert.match(source, /fields\?: string/);
    }
  });

  it("detail routes are unchanged (no fields param on :id handlers)", () => {
    assert.doesNotMatch(readRoute("memory.ts"), /\/memory\/:id[\s\S]*fields\?:/);
    assert.doesNotMatch(readRoute("retrieval.ts"), /\/retrieval\/:traceId[\s\S]*fields\?:/);
  });

  it("rejects internal field names for memory list", () => {
    const parsed = parseListFieldsQuery("memory", "id,result");
    assert.equal(parsed.ok, false);
  });

  it("projects retrieval rows for dashboard picker shape", () => {
    const rows = [
      {
        retrievalTraceId: "01RETR",
        workspaceId: "01WS",
        query: "enterprise policy",
        status: "completed",
        hasContextPackage: true,
        createdAt: "2026-06-08T12:00:00.000Z",
        completedAt: "2026-06-08T12:00:01.000Z",
      },
    ];
    const parsed = parseListFieldsQuery(
      "retrieval",
      "retrievalTraceId,query,status,hasContextPackage",
    );
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const projected = projectListRows(rows, parsed.fields);
    assert.deepEqual(projected[0], {
      retrievalTraceId: "01RETR",
      query: "enterprise policy",
      status: "completed",
      hasContextPackage: true,
    });
    assert.equal("workspaceId" in (projected[0] ?? {}), false);
  });

  it("allowlists cover only public list columns", () => {
    assert.deepEqual(LIST_FIELD_ALLOWLISTS.memory.includes("result"), false);
    assert.deepEqual(LIST_FIELD_ALLOWLISTS.retrieval.includes("contextPackage"), false);
  });
});
