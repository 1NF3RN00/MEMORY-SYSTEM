import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { describe, it } from "node:test";
import type { Logger } from "../logger.js";
import {
  registerSlowQueryExplainHook,
  resetExplainCaptureCountsForTests,
  type PrismaQueryEvent,
} from "./explain-on-slow.js";
import { runWithDbObservationScope } from "./scope.js";

type QueryHandler = (event: PrismaQueryEvent) => void;

function createMockPrismaClient(explainPayload: unknown): {
  client: PrismaClient;
  emitQuery: (event: PrismaQueryEvent) => void;
  explainCalls: number;
} {
  let handler: QueryHandler | undefined;
  let explainCalls = 0;

  const client = {
    $on(eventType: string, callback: QueryHandler): void {
      if (eventType === "query") {
        handler = callback;
      }
    },
    async $queryRawUnsafe(): Promise<Array<{ "QUERY PLAN": unknown }>> {
      explainCalls += 1;
      return [{ "QUERY PLAN": explainPayload }];
    },
  } as unknown as PrismaClient;

  return {
    client,
    emitQuery(event: PrismaQueryEvent): void {
      handler?.(event);
    },
    get explainCalls() {
      return explainCalls;
    },
  };
}

function createCapturingLogger(): { logger: Logger; warns: Array<Record<string, unknown>> } {
  const warns: Array<Record<string, unknown>> = [];
  const logger = {
    warn(payload: Record<string, unknown>) {
      warns.push(payload);
    },
    error() {},
    debug() {},
    info() {},
  } as unknown as Logger;
  return { logger, warns };
}

const sampleExplainPayload = [
  {
    Plan: {
      "Node Type": "Seq Scan",
      "Relation Name": "memory",
      Filter: "(workspace_id = '01ARZ3NDEKTSV4RRFFQ69G5FAV'::text)",
    },
    "Planning Time": 0.25,
  },
];

function slowSelectEvent(durationMs: number): PrismaQueryEvent {
  return {
    timestamp: new Date(),
    query: "SELECT id FROM memory WHERE workspace_id = $1",
    params: '["01ARZ3NDEKTSV4RRFFQ69G5FAV"]',
    duration: durationMs,
    target: "quaint::connector::metrics",
  };
}

describe("sprint-26 verification: explain-on-slow hook", () => {
  it("synthetic slow SELECT triggers database.query.explain log with sanitized plan", async () => {
    resetExplainCaptureCountsForTests();
    const mock = createMockPrismaClient(sampleExplainPayload);
    const { logger, warns } = createCapturingLogger();

    registerSlowQueryExplainHook({
      client: mock.client,
      logger,
      slowQueryMs: 100,
      analyze: false,
    });

    await runWithDbObservationScope({ scopeId: "01SLOWEXPLAIN", scopeType: "retrieval" }, async () => {
      mock.emitQuery(slowSelectEvent(150));
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    });

    assert.equal(mock.explainCalls, 1);
    assert.equal(warns.length, 1);
    const payload = warns[0]!;
    assert.equal(payload.event, "database.query.explain");
    assert.equal(payload.scope_id, "01SLOWEXPLAIN");
    assert.equal(payload.scope_type, "retrieval");
    assert.equal(payload.explain_analyze, false);
    assert.match(String(payload.sql_fingerprint), /^[a-f0-9]{12}$/);
    assert.ok(Array.isArray(payload.explain_plan));
    assert.doesNotMatch(JSON.stringify(payload), /01ARZ3NDEKTSV4RRFFQ69G5FAV/);
  });

  it("fast queries and writes do not trigger EXPLAIN", async () => {
    resetExplainCaptureCountsForTests();
    const mock = createMockPrismaClient(sampleExplainPayload);
    const { logger, warns } = createCapturingLogger();

    registerSlowQueryExplainHook({
      client: mock.client,
      logger,
      slowQueryMs: 100,
    });

    await runWithDbObservationScope({ scopeId: "01NOEXPLAIN", scopeType: "retrieval" }, async () => {
      mock.emitQuery(slowSelectEvent(50));
      mock.emitQuery({
        ...slowSelectEvent(200),
        query: "INSERT INTO memory (id) VALUES ($1)",
      });
      await new Promise((resolve) => setTimeout(resolve, 10));
      return true;
    });

    assert.equal(mock.explainCalls, 0);
    assert.equal(warns.length, 0);
  });

  it("caps EXPLAIN captures at three per scope", async () => {
    resetExplainCaptureCountsForTests();
    const mock = createMockPrismaClient(sampleExplainPayload);
    const { logger, warns } = createCapturingLogger();

    registerSlowQueryExplainHook({
      client: mock.client,
      logger,
      slowQueryMs: 100,
    });

    await runWithDbObservationScope({ scopeId: "01CAP", scopeType: "request" }, async () => {
      for (let i = 0; i < 5; i += 1) {
        mock.emitQuery(slowSelectEvent(120 + i));
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
      return true;
    });

    assert.equal(mock.explainCalls, 3);
    assert.equal(warns.length, 3);
  });
});
