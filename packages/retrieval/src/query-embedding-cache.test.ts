import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildQueryEmbeddingCacheKey,
  QueryEmbeddingCache,
  resolveQueryEmbedding,
} from "./query-embedding-cache.js";

describe("QueryEmbeddingCache", () => {
  it("builds workspace-scoped keys from normalized query and embedding input", () => {
    const keyA = buildQueryEmbeddingCacheKey("ws-1", "pricing policy", "[anchors] pricing policy");
    const keyB = buildQueryEmbeddingCacheKey("ws-2", "pricing policy", "[anchors] pricing policy");
    const keyC = buildQueryEmbeddingCacheKey("ws-1", "pricing policy", "[anchors] pricing policy v2");

    assert.notEqual(keyA, keyB);
    assert.notEqual(keyA, keyC);
    assert.equal(keyA, buildQueryEmbeddingCacheKey("ws-1", "pricing policy", "[anchors] pricing policy"));
  });

  it("returns cached vectors without calling the client on hit", async () => {
    const cache = new QueryEmbeddingCache();
    let calls = 0;
    const client = {
      async embed() {
        calls += 1;
        return [[0.1, 0.2]];
      },
    };

    const first = await resolveQueryEmbedding({
      workspaceId: "ws-1",
      normalizedQuery: "enterprise pricing",
      embeddingInput: "[anchors] enterprise pricing",
      client,
      cache,
    });
    const second = await resolveQueryEmbedding({
      workspaceId: "ws-1",
      normalizedQuery: "enterprise pricing",
      embeddingInput: "[anchors] enterprise pricing",
      client,
      cache,
    });

    assert.equal(calls, 1);
    assert.equal(first.cacheHit, false);
    assert.equal(second.cacheHit, true);
    assert.deepEqual(second.embedding, [0.1, 0.2]);
  });

  it("isolates workspaces with identical normalized queries", async () => {
    const cache = new QueryEmbeddingCache();
    let calls = 0;
    const client = {
      async embed(texts: string[]) {
        calls += 1;
        return texts.map((text) => [text.length]);
      },
    };

    await resolveQueryEmbedding({
      workspaceId: "ws-a",
      normalizedQuery: "shared query",
      embeddingInput: "shared query",
      client,
      cache,
    });
    await resolveQueryEmbedding({
      workspaceId: "ws-b",
      normalizedQuery: "shared query",
      embeddingInput: "shared query",
      client,
      cache,
    });

    assert.equal(calls, 2);
    assert.equal(cache.size(), 2);
  });

  it("evicts least-recently-used entries at capacity", () => {
    const cache = new QueryEmbeddingCache({ maxEntries: 2, ttlMs: 60_000 });

    cache.set("a", [1]);
    cache.set("b", [2]);
    cache.set("c", [3]);

    assert.equal(cache.get("a"), undefined);
    assert.deepEqual(cache.get("b"), [2]);
    assert.deepEqual(cache.get("c"), [3]);
    assert.equal(cache.size(), 2);
  });

  it("expires entries after ttl", async () => {
    const cache = new QueryEmbeddingCache({ maxEntries: 10, ttlMs: 5 });
    cache.set("key", [0.5]);

    assert.deepEqual(cache.get("key"), [0.5]);

    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(cache.get("key"), undefined);
  });
});
