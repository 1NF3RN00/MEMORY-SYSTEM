export { createLogger, type Logger, type LoggerOptions } from "./logger.js";
export { createTraceContext, generateTraceId, type TraceContext } from "./trace.js";
export { createStructuredEvent, type StructuredEventInput } from "./events/event-factory.js";
export { createLoggingEventEmitter, type EventEmitter, type EventSink } from "./events/event-emitter.js";
export { registerRequestLogging, type RequestLoggingOptions } from "./middleware/request-logging.js";
export { registerRequestTiming, withRequestTiming, type RequestTimingOptions } from "./middleware/request-timing.js";
export { ExecutionTimingCollector } from "./timing/collector.js";
export { getTimingCollector, getOrCreateTimingCollector, runWithTiming, runWithTimingAsync } from "./timing/context.js";
export { emitTimingAudit } from "./timing/emit.js";
export { LlmCallCollector, type RecordLlmCallInput } from "./llm/collector.js";
export {
  getLlmCallCollector,
  getOrCreateLlmCallCollector,
  runWithLlmCall,
  runWithLlmCallAsync,
} from "./llm/context.js";
export { recordLlmCall } from "./llm/record.js";
export { emitLlmCallAudit } from "./llm/emit.js";
export { estimateLlmCostUsd, resolveModelPricing } from "./llm/pricing.js";
export { nowHr, hrToMs, isoNow } from "./timing/hrtime.js";
export {
  bridgeCompressionStages,
  bridgeContextRenderStages,
  bridgeIngestionStages,
  bridgePlanningStages,
  bridgeRetrievalStages,
} from "./timing/bridge.js";
export { measurePipelineStage, mergePipelineAudit, resolvePipelineCollector } from "./timing/pipeline.js";
export {
  createInstrumentedPrismaClient,
  type InstrumentedPrismaClient,
  type InstrumentPrismaOptions,
} from "./database/instrument-prisma.js";
export { fingerprintQuery, normalizeQueryArgs } from "./database/fingerprint.js";
export { DbQueryAggregator, toRetrievalDbObservability } from "./database/aggregator.js";
export {
  activateDbObservationScope,
  getDbQueryAggregator,
  recordScopedQuery,
  runWithDbObservationScope,
  type DbObservationScope,
} from "./database/scope.js";
export { emitDbScopeCompleted, type EmitDbScopeCompletedOptions } from "./database/emit.js";
export {
  DbOperationLeaderboard,
  getDbOperationLeaderboard,
  resetDbOperationLeaderboardForTests,
  summaryToLeaderboardEntry,
} from "./database/leaderboard.js";
export {
  DB_SCOPE_COMPLETED_EVENT_TYPE,
  paginateLeaderboardEntries,
  parseEventLogDbScopeEntry,
  queryLeaderboardFromEventLogRows,
  type EventLogDbScopeRow,
} from "./database/history.js";
export {
  registerRequestDbObservation,
  type RequestDbObservationOptions,
} from "./middleware/request-db-observation.js";
export {
  buildExplainSql,
  buildPlanSummary,
  fingerprintSql,
  isExplainEligibleSql,
  parseExplainPayload,
  parsePrismaQueryParams,
  registerSlowQueryExplainHook,
  resetExplainCaptureCountsForTests,
  runExplainCapture,
  sanitizeExplainPlanNode,
  sanitizeFilterLiteral,
  type RegisterSlowQueryExplainOptions,
  type SanitizedExplainPlanNode,
  type SlowQueryExplainCapture,
} from "./database/explain-on-slow.js";
