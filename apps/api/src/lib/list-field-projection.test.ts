import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIST_FIELD_ALLOWLISTS,
  parseListFieldsQuery,
  projectListRow,
  projectListRows,
} from "./list-field-projection.js";

describe("list-field-projection", () => {
  const memoryRow = {
    id: "mem-1",
    title: "Policy handbook",
    memoryType: "semantic",
    sourceType: "document",
    persistenceMode: "durable",
    archived: false,
    retrievalEligible: true,
    ingestionStatus: "completed",
    chunkCount: 12,
    createdAt: "2026-06-08T12:00:00.000Z",
    archivedAt: undefined,
  };

  it("returns null fields when query param is omitted (default full rows)", () => {
    const parsed = parseListFieldsQuery("memory");
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.fields, null);
    }
    assert.deepEqual(projectListRow(memoryRow, null), memoryRow);
  });

  it("projects only requested allowlisted columns", () => {
    const parsed = parseListFieldsQuery("memory", "id,title,memoryType,persistenceMode,archived");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;

    const projected = projectListRow(memoryRow, parsed.fields);
    assert.deepEqual(projected, {
      id: "mem-1",
      title: "Policy handbook",
      memoryType: "semantic",
      persistenceMode: "durable",
      archived: false,
    });
    assert.equal("sourceType" in projected, false);
    assert.equal("chunkCount" in projected, false);
  });

  it("rejects unknown or internal field names", () => {
    const parsed = parseListFieldsQuery("memory", "id,result,workspaceId");
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.deepEqual(parsed.invalidFields.sort(), ["result", "workspaceId"]);
  });

  it("rejects empty fields token list", () => {
    const parsed = parseListFieldsQuery("retrieval", "  ,  , ");
    assert.equal(parsed.ok, false);
  });

  it("deduplicates repeated field tokens", () => {
    const parsed = parseListFieldsQuery("retrieval", "retrievalTraceId,status,retrievalTraceId");
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.deepEqual(parsed.fields, ["retrievalTraceId", "status"]);
  });

  it("memory summary projection is materially smaller than default", () => {
    const fullJson = JSON.stringify(memoryRow);
    const summaryFields = ["id", "title", "memoryType", "persistenceMode", "archived"] as const;
    const summaryJson = JSON.stringify(projectListRow(memoryRow, [...summaryFields]));
    const fullBytes = Buffer.byteLength(fullJson, "utf8");
    const summaryBytes = Buffer.byteLength(summaryJson, "utf8");
    const reductionPct = ((fullBytes - summaryBytes) / fullBytes) * 100;

    assert.ok(summaryBytes < fullBytes);
    assert.ok(reductionPct >= 30, `expected >=30% reduction, got ${reductionPct.toFixed(1)}%`);
  });

  it("projectListRows maps arrays", () => {
    const rows = projectListRows([memoryRow], ["id", "title"]);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { id: "mem-1", title: "Policy handbook" });
  });

  it("allowlists do not include internal-only names", () => {
    for (const resource of Object.keys(LIST_FIELD_ALLOWLISTS) as Array<keyof typeof LIST_FIELD_ALLOWLISTS>) {
      const fields = LIST_FIELD_ALLOWLISTS[resource];
      assert.equal(fields.includes("result"), false);
      assert.equal(fields.includes("password"), false);
    }
  });
});
