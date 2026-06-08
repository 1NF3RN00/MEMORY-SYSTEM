import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { loadDbObservabilityEnv } from "./db-observability-env.js";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("loadDbObservabilityEnv", () => {
  it("defaults DB_SLOW_QUERY_MS to 100", () => {
    delete process.env.DB_SLOW_QUERY_MS;
    const env = loadDbObservabilityEnv();
    assert.equal(env.DB_SLOW_QUERY_MS, 100);
  });

  it("reads custom slow query threshold from environment", () => {
    process.env.DB_SLOW_QUERY_MS = "250";
    const env = loadDbObservabilityEnv();
    assert.equal(env.DB_SLOW_QUERY_MS, 250);
  });

  it("defaults DB_OBSERVATION_ENABLED to true unless explicitly false", () => {
    delete process.env.DB_OBSERVATION_ENABLED;
    assert.equal(loadDbObservabilityEnv().DB_OBSERVATION_ENABLED, true);

    process.env.DB_OBSERVATION_ENABLED = "false";
    assert.equal(loadDbObservabilityEnv().DB_OBSERVATION_ENABLED, false);
  });

  it("defaults DB_EXPLAIN_ON_SLOW to false unless explicitly true", () => {
    delete process.env.DB_EXPLAIN_ON_SLOW;
    assert.equal(loadDbObservabilityEnv().DB_EXPLAIN_ON_SLOW, false);

    process.env.DB_EXPLAIN_ON_SLOW = "true";
    assert.equal(loadDbObservabilityEnv().DB_EXPLAIN_ON_SLOW, true);
  });

  it("defaults DB_EXPLAIN_ANALYZE to false unless explicitly true", () => {
    delete process.env.DB_EXPLAIN_ANALYZE;
    assert.equal(loadDbObservabilityEnv().DB_EXPLAIN_ANALYZE, false);

    process.env.DB_EXPLAIN_ANALYZE = "true";
    assert.equal(loadDbObservabilityEnv().DB_EXPLAIN_ANALYZE, true);
  });

  it("reads DB_N_PLUS_ONE_THRESHOLD from environment", () => {
    process.env.DB_N_PLUS_ONE_THRESHOLD = "5";
    const env = loadDbObservabilityEnv();
    assert.equal(env.DB_N_PLUS_ONE_THRESHOLD, 5);
  });

  it("defaults DB_LEADERBOARD_HISTORY_WINDOW to 1000", () => {
    delete process.env.DB_LEADERBOARD_HISTORY_WINDOW;
    const env = loadDbObservabilityEnv();
    assert.equal(env.DB_LEADERBOARD_HISTORY_WINDOW, 1000);
  });
});
