import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fingerprintQuery, normalizeQueryArgs } from "./fingerprint.js";

describe("fingerprintQuery", () => {
  it("strips ULID id values for deterministic fingerprints", () => {
    const idA = "01ARZ3NDEKTSV4RRFFQ69G5FAV";
    const idB = "01J00000000000000000000000";
    const fpA = fingerprintQuery("Memory", "findUnique", { where: { id: idA } });
    const fpB = fingerprintQuery("Memory", "findUnique", { where: { id: idB } });
    assert.equal(fpA, fpB);
  });

  it("normalizes key order deterministically", () => {
    const fpA = fingerprintQuery("MemoryChunk", "findMany", {
      where: { workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAV", memoryId: "01J00000000000000000000000" },
      take: 10,
    });
    const fpB = fingerprintQuery("MemoryChunk", "findMany", {
      take: 10,
      where: { memoryId: "01J00000000000000000000001", workspaceId: "01ARZ3NDEKTSV4RRFFQ69G5FAX" },
    });
    assert.equal(fpA, fpB);
  });

  it("keeps non-id literals distinct", () => {
    const fpA = fingerprintQuery("Workspace", "findMany", { where: { slug: "alpha" } });
    const fpB = fingerprintQuery("Workspace", "findMany", { where: { slug: "beta" } });
    assert.notEqual(fpA, fpB);
  });
});

describe("normalizeQueryArgs", () => {
  it("replaces integer id fields with placeholder", () => {
    assert.deepEqual(normalizeQueryArgs({ where: { id: 42 } }), { where: { id: "<id>" } });
  });

  it("preserves non-id numeric fields", () => {
    assert.deepEqual(normalizeQueryArgs({ take: 10 }), { take: 10 });
  });
});
