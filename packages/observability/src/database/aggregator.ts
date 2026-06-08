import { newUlid } from "@memory-middleware/shared-types";
import type {
  DbDuplicateQueryGroup,
  DbNPlusOnePattern,
  DbQueryRecord,
  DbScopeSummary,
  RetrievalDbObservability,
} from "@memory-middleware/shared-types";
import { fingerprintQuery, hasSingleIdFilter, isReadOperation } from "./fingerprint.js";
import { isoNow } from "../timing/hrtime.js";

export interface DbAggregatorOptions {
  slowQueryMs?: number;
  nPlusOneThreshold?: number;
}

interface FingerprintBucket {
  count: number;
  totalDurationMs: number;
  sample: DbQueryRecord;
  model: string;
  operation: string;
  args: unknown;
}

export class DbQueryAggregator {
  private readonly scopeId: string;
  private readonly scopeType: DbScopeSummary["scopeType"];
  private readonly slowQueryMs: number;
  private readonly nPlusOneThreshold: number;
  private totalDbTime = 0;
  private readonly records: DbQueryRecord[] = [];
  private readonly fingerprints = new Map<string, FingerprintBucket>();

  constructor(
    scopeId: string,
    scopeType: DbScopeSummary["scopeType"],
    options: DbAggregatorOptions = {},
  ) {
    this.scopeId = scopeId;
    this.scopeType = scopeType;
    this.slowQueryMs = options.slowQueryMs ?? 100;
    this.nPlusOneThreshold = options.nPlusOneThreshold ?? 3;
  }

  getScopeId(): string {
    return this.scopeId;
  }

  getScopeType(): DbScopeSummary["scopeType"] {
    return this.scopeType;
  }

  recordQuery(input: {
    model: string;
    operation: string;
    args: unknown;
    durationMs: number;
  }): DbQueryRecord {
    const durationMs = Math.round(input.durationMs * 1000) / 1000;
    const fingerprint = fingerprintQuery(input.model, input.operation, input.args);
    const record: DbQueryRecord = {
      queryId: newUlid(),
      model: input.model,
      operation: input.operation,
      durationMs,
      fingerprint,
      isSlow: durationMs >= this.slowQueryMs,
      timestamp: isoNow(),
    };

    this.records.push(record);
    this.totalDbTime += durationMs;

    const bucket = this.fingerprints.get(fingerprint);
    if (bucket) {
      bucket.count += 1;
      bucket.totalDurationMs += durationMs;
    } else {
      this.fingerprints.set(fingerprint, {
        count: 1,
        totalDurationMs: durationMs,
        sample: record,
        model: input.model,
        operation: input.operation,
        args: input.args,
      });
    }

    return record;
  }

  toSummary(): DbScopeSummary {
    const slowQueries = this.records.filter((record) => record.isSlow);
    const duplicateQueries: DbDuplicateQueryGroup[] = [];
    const nPlusOnePatterns: DbNPlusOnePattern[] = [];

    for (const [fingerprint, bucket] of this.fingerprints.entries()) {
      if (bucket.count >= 2) {
        duplicateQueries.push({
          fingerprint,
          count: bucket.count,
          totalDurationMs: Math.round(bucket.totalDurationMs * 1000) / 1000,
          sample: bucket.sample,
        });
      }

      if (
        bucket.count >= this.nPlusOneThreshold &&
        isReadOperation(bucket.operation) &&
        hasSingleIdFilter(bucket.args)
      ) {
        nPlusOnePatterns.push({
          fingerprint,
          count: bucket.count,
          model: bucket.model,
          operation: bucket.operation,
        });
      }
    }

    duplicateQueries.sort((a, b) => b.count - a.count);
    slowQueries.sort((a, b) => b.durationMs - a.durationMs);

    return {
      scopeId: this.scopeId,
      scopeType: this.scopeType,
      totalQueries: this.records.length,
      totalDbTime: Math.round(this.totalDbTime * 1000) / 1000,
      slowQueries,
      duplicateQueries,
      nPlusOnePatterns,
    };
  }
}

export function toRetrievalDbObservability(summary: DbScopeSummary): RetrievalDbObservability {
  return {
    retrievalId: summary.scopeId,
    totalQueries: summary.totalQueries,
    totalDbTime: summary.totalDbTime,
    slowQueries: summary.slowQueries,
    duplicateQueries: summary.duplicateQueries,
  };
}
