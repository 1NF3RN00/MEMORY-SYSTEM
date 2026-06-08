import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadRetrievalBm25Env } from "./retrieval-bm25-env.js";

describe("loadRetrievalBm25Env", () => {
  it("defaults parallel BM25 V2 flag to false", () => {
    const previous = process.env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED;
    delete process.env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED;

    try {
      const env = loadRetrievalBm25Env();
      assert.equal(env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED, false);
    } finally {
      if (previous === undefined) {
        delete process.env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED;
      } else {
        process.env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED = previous;
      }
    }
  });

  it("parses explicit true", () => {
    const previous = process.env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED;
    process.env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED = "true";

    try {
      const env = loadRetrievalBm25Env();
      assert.equal(env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED, true);
    } finally {
      if (previous === undefined) {
        delete process.env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED;
      } else {
        process.env.RETRIEVAL_PARALLEL_BM25_V2_ENABLED = previous;
      }
    }
  });
});
