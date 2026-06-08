import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { loadCompressionEnv } from "./compression-env.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("loadCompressionEnv", () => {
  it("defaults API_COMPRESSION_ENABLED to true unless explicitly false", () => {
    delete process.env.API_COMPRESSION_ENABLED;
    assert.equal(loadCompressionEnv().API_COMPRESSION_ENABLED, true);

    process.env.API_COMPRESSION_ENABLED = "false";
    assert.equal(loadCompressionEnv().API_COMPRESSION_ENABLED, false);
  });

  it("defaults API_COMPRESSION_THRESHOLD_BYTES to 1024", () => {
    delete process.env.API_COMPRESSION_THRESHOLD_BYTES;
    assert.equal(loadCompressionEnv().API_COMPRESSION_THRESHOLD_BYTES, 1024);
  });

  it("reads custom threshold from environment", () => {
    process.env.API_COMPRESSION_THRESHOLD_BYTES = "2048";
    assert.equal(loadCompressionEnv().API_COMPRESSION_THRESHOLD_BYTES, 2048);
  });
});
