import type { ExecutionTimingAudit } from "@memory-middleware/shared-types";
import { ExecutionTimingCollector } from "./collector.js";
import { getTimingCollector } from "./context.js";

export function resolvePipelineCollector(
  traceId: string,
  collector?: ExecutionTimingCollector,
): ExecutionTimingCollector | undefined {
  return collector ?? getTimingCollector();
}

export async function measurePipelineStage<T>(
  traceId: string,
  stage: string,
  collector: ExecutionTimingCollector | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  if (!collector) return fn();
  return collector.measureAsync(stage, fn);
}

export function mergePipelineAudit(
  collector: ExecutionTimingCollector | undefined,
  audit?: ExecutionTimingAudit,
): ExecutionTimingAudit | undefined {
  if (!collector && !audit) return undefined;
  const base = collector?.toAudit();
  if (!base) return audit;
  if (!audit) return base;
  return {
    requestId: base.requestId,
    totalLatency: base.totalLatency,
    stages: [...base.stages, ...audit.stages],
  };
}
