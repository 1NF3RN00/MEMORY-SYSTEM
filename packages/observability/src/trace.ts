import { isUlid, newUlid } from "@memory-middleware/shared-types";

export interface TraceContext {
  traceId: string;
  parentTraceId?: string;
}

export function generateTraceId(): string {
  return newUlid();
}

export function createTraceContext(
  incomingTraceId?: string,
  parentTraceId?: string,
): TraceContext {
  const trimmed = incomingTraceId?.trim();
  const traceId = trimmed && isUlid(trimmed) ? trimmed : generateTraceId();
  const context: TraceContext = { traceId };

  if (parentTraceId) {
    context.parentTraceId = parentTraceId;
  }

  return context;
}
