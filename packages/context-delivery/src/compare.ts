import type {
  ContextDeliveryCompareResult,
  ContextPackageInput,
  DeliveryContext,
  TraceStrippingDecision,
} from "@memory-middleware/shared-types";
import { STRIPPED_MIDDLEWARE_FIELDS } from "@memory-middleware/shared-types";
import { estimateMiddlewarePayloadTokens } from "./trace-stripping.js";

export function compareDeliveryContexts(
  deliveryA: DeliveryContext,
  deliveryB: DeliveryContext,
  originalPackage?: ContextPackageInput,
): ContextDeliveryCompareResult {
  const rawMiddlewareTokenEstimate = originalPackage
    ? estimateMiddlewarePayloadTokens(originalPackage)
    : 0;

  const tokenDelta = deliveryB.tokenCount - deliveryA.tokenCount;
  const sectionDelta = deliveryB.renderedSections.length - deliveryA.renderedSections.length;

  const diffSummary = [
    `Mode ${deliveryA.mode} → ${deliveryB.mode}`,
    `Token count: ${deliveryA.tokenCount} → ${deliveryB.tokenCount} (${tokenDelta >= 0 ? "+" : ""}${tokenDelta})`,
    `Sections: ${deliveryA.renderedSections.length} → ${deliveryB.renderedSections.length} (${sectionDelta >= 0 ? "+" : ""}${sectionDelta})`,
    originalPackage
      ? `Middleware payload ~${rawMiddlewareTokenEstimate} tokens stripped from delivery`
      : "Original middleware package unavailable",
  ].join(". ");

  return {
    deliveryIdA: deliveryA.deliveryId,
    deliveryIdB: deliveryB.deliveryId,
    modeA: deliveryA.mode,
    modeB: deliveryB.mode,
    tokenCountA: deliveryA.tokenCount,
    tokenCountB: deliveryB.tokenCount,
    tokenDelta,
    sectionCountA: deliveryA.renderedSections.length,
    sectionCountB: deliveryB.renderedSections.length,
    rawMiddlewareTokenEstimate,
    renderedTokenEstimate: deliveryB.tokenCount,
    strippedFields: [...STRIPPED_MIDDLEWARE_FIELDS],
    diffSummary,
  };
}

export function buildContextDiff(
  originalPackage: ContextPackageInput,
  delivery: DeliveryContext,
  traceStripping: TraceStrippingDecision,
): {
  rawMiddlewareSummary: string;
  renderedPreview: string;
  strippedFieldCount: number;
  tokenReductionEstimate: number;
} {
  const rawMiddlewareTokenEstimate = estimateMiddlewarePayloadTokens(originalPackage);
  const tokenReductionEstimate = Math.max(
    0,
    rawMiddlewareTokenEstimate - delivery.tokenCount,
  );

  const rawMiddlewareSummary = [
    `Query: ${originalPackage.query}`,
    `Memories: ${originalPackage.memories.length}`,
    `Chunk traces: ${originalPackage.chunkTraces.length}`,
    `Ranking breakdown entries: ${originalPackage.rankingBreakdown.length}`,
    `Rejected candidates: ${originalPackage.rejectedCandidates.length}`,
    `Estimated operational payload: ~${rawMiddlewareTokenEstimate} tokens`,
  ].join("\n");

  return {
    rawMiddlewareSummary,
    renderedPreview: delivery.renderedContext,
    strippedFieldCount: traceStripping.strippedFields.length,
    tokenReductionEstimate,
  };
}
