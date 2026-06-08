import { AsyncLocalStorage } from "node:async_hooks";
import type { DbQueryRecord, DbScopeSummary } from "@memory-middleware/shared-types";
import { DbQueryAggregator, type DbAggregatorOptions } from "./aggregator.js";

const dbStorage = new AsyncLocalStorage<DbQueryAggregator>();

export interface DbObservationScope {
  scopeId: string;
  scopeType: DbScopeSummary["scopeType"];
}

export async function runWithDbObservationScope<T>(
  scope: DbObservationScope,
  fn: () => Promise<T>,
  options: DbAggregatorOptions = {},
): Promise<{ result: T; summary: DbScopeSummary }> {
  const aggregator = new DbQueryAggregator(scope.scopeId, scope.scopeType, options);
  const result = await dbStorage.run(aggregator, fn);
  return { result, summary: aggregator.toSummary() };
}

export function activateDbObservationScope(
  scope: DbObservationScope,
  options: DbAggregatorOptions,
  done: () => void,
): void {
  const aggregator = new DbQueryAggregator(scope.scopeId, scope.scopeType, options);
  dbStorage.run(aggregator, done);
}

export function getDbQueryAggregator(): DbQueryAggregator | undefined {
  return dbStorage.getStore();
}

export function recordScopedQuery(input: {
  model: string;
  operation: string;
  args: unknown;
  durationMs: number;
}): DbQueryRecord | undefined {
  const aggregator = dbStorage.getStore();
  if (!aggregator) return undefined;
  return aggregator.recordQuery(input);
}
