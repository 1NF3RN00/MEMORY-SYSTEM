import type { CompressionContextResolveError } from "@memory-middleware/shared-types";

export interface CompressionTraceRow {
  compressionTraceId: string;
  retrievalTraceId: string;
}

export interface CompressionTraceIdHint {
  message: string;
  compressionTraceId: string;
  retrievalTraceId: string;
}

export function findCompressionTraceMatch(
  traceId: string,
  compressionTraces: CompressionTraceRow[],
): CompressionTraceRow | null {
  const normalized = traceId.trim();
  if (!normalized) return null;
  return compressionTraces.find((t) => t.compressionTraceId === normalized) ?? null;
}

export function buildCompressionTraceIdHint(
  match: CompressionTraceRow,
): CompressionTraceIdHint {
  return {
    message:
      "This ID is a compression trace, not a retrieval trace. Use the linked retrieval trace below to run compression again.",
    compressionTraceId: match.compressionTraceId,
    retrievalTraceId: match.retrievalTraceId,
  };
}

export function hintFromCompressionResolveError(
  body: CompressionContextResolveError,
): CompressionTraceIdHint | null {
  if (body.code !== "compression_trace_id_provided") return null;
  if (!body.compressionTraceId || !body.retrievalTraceId) return null;
  return {
    message: body.error,
    compressionTraceId: body.compressionTraceId,
    retrievalTraceId: body.retrievalTraceId,
  };
}

export function validateRetrievalTraceIdForCompress(
  traceId: string,
  compressionTraces: CompressionTraceRow[],
): CompressionTraceIdHint | null {
  const match = findCompressionTraceMatch(traceId, compressionTraces);
  return match ? buildCompressionTraceIdHint(match) : null;
}
