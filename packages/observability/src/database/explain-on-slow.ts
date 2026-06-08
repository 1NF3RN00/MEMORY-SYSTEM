import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import type { Logger } from "../logger.js";
import { getDbQueryAggregator } from "./scope.js";

const MAX_EXPLAIN_PER_SCOPE = 3;
const READ_SQL_PATTERN = /^\s*(SELECT|WITH)\b/i;
const EXPLAIN_SQL_PATTERN = /^\s*EXPLAIN\b/i;

const scopeExplainCounts = new Map<string, number>();

export interface SanitizedExplainPlanNode {
  nodeType: string;
  relationName?: string;
  indexName?: string;
  actualTotalTime?: number;
  actualRows?: number;
  filter?: string;
  indexCond?: string;
  plans?: SanitizedExplainPlanNode[];
}

export interface SlowQueryExplainCapture {
  sqlFingerprint: string;
  planSummary: string;
  indexNames: string[];
  sanitizedPlan: SanitizedExplainPlanNode[];
  planningTimeMs: number | null;
}

export function isExplainEligibleSql(sql: string): boolean {
  const trimmed = sql.trim();
  if (!trimmed || EXPLAIN_SQL_PATTERN.test(trimmed)) {
    return false;
  }
  return READ_SQL_PATTERN.test(trimmed);
}

export function fingerprintSql(sql: string): string {
  const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

export function sanitizeFilterLiteral(value: string): string {
  return value
    .replace(/'[^']*'/g, "'<redacted>'")
    .replace(/[0-7][0-9A-HJKMNP-TV-Z]{25}/g, "<id>")
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
      "<id>",
    );
}

interface PostgresExplainPlanJson {
  "Node Type"?: string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Actual Total Time"?: number;
  "Actual Rows"?: number;
  Filter?: string;
  "Index Cond"?: string;
  Plans?: PostgresExplainPlanJson[];
}

interface PostgresExplainRootJson {
  Plan?: PostgresExplainPlanJson;
  "Planning Time"?: number;
}

export function sanitizeExplainPlanNode(plan: PostgresExplainPlanJson): SanitizedExplainPlanNode {
  const node: SanitizedExplainPlanNode = {
    nodeType: plan["Node Type"] ?? "Unknown",
  };
  if (plan["Relation Name"]) node.relationName = plan["Relation Name"];
  if (plan["Index Name"]) node.indexName = plan["Index Name"];
  if (plan["Actual Total Time"] !== undefined) node.actualTotalTime = plan["Actual Total Time"];
  if (plan["Actual Rows"] !== undefined) node.actualRows = plan["Actual Rows"];
  if (plan.Filter) node.filter = sanitizeFilterLiteral(plan.Filter);
  if (plan["Index Cond"]) node.indexCond = sanitizeFilterLiteral(plan["Index Cond"]);
  if (plan.Plans?.length) {
    node.plans = plan.Plans.map(sanitizeExplainPlanNode);
  }
  return node;
}

export function parseExplainPayload(payload: unknown): {
  sanitizedPlan: SanitizedExplainPlanNode[];
  planningTimeMs: number | null;
} {
  const root = Array.isArray(payload)
    ? (payload[0] as PostgresExplainRootJson | undefined)
    : undefined;
  if (!root?.Plan) {
    return { sanitizedPlan: [], planningTimeMs: null };
  }
  return {
    sanitizedPlan: [sanitizeExplainPlanNode(root.Plan)],
    planningTimeMs: root["Planning Time"] ?? null,
  };
}

export function collectIndexNames(plan: SanitizedExplainPlanNode): string[] {
  const names = new Set<string>();
  const walk = (node: SanitizedExplainPlanNode): void => {
    if (node.indexName) names.add(node.indexName);
    node.plans?.forEach(walk);
  };
  walk(plan);
  return [...names];
}

export function buildPlanSummary(plan: SanitizedExplainPlanNode): string {
  const indexes = collectIndexNames(plan);
  const parts = [plan.nodeType];
  if (plan.relationName) parts.push(`on ${plan.relationName}`);
  if (indexes.length > 0) parts.push(`indexes: ${indexes.join(", ")}`);
  return parts.join(" ");
}

export function buildExplainSql(sql: string, analyze: boolean): string {
  const options = analyze ? "ANALYZE, BUFFERS, FORMAT JSON" : "FORMAT JSON";
  return `EXPLAIN (${options}) ${sql}`;
}

export function parsePrismaQueryParams(params: string): unknown[] {
  if (!params) return [];
  try {
    const parsed = JSON.parse(params) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function runExplainCapture(
  client: PrismaClient,
  sql: string,
  params: unknown[],
  analyze: boolean,
): Promise<SlowQueryExplainCapture | null> {
  const explainSql = buildExplainSql(sql, analyze);
  const rows = await client.$queryRawUnsafe<Array<{ "QUERY PLAN": unknown }>>(
    explainSql,
    ...params,
  );
  const payload = rows[0]?.["QUERY PLAN"];
  const { sanitizedPlan, planningTimeMs } = parseExplainPayload(payload);
  if (sanitizedPlan.length === 0) {
    return null;
  }
  const root = sanitizedPlan[0]!;
  return {
    sqlFingerprint: fingerprintSql(sql),
    planSummary: buildPlanSummary(root),
    indexNames: collectIndexNames(root),
    sanitizedPlan,
    planningTimeMs,
  };
}

function canCaptureExplainForScope(scopeId: string): boolean {
  const count = scopeExplainCounts.get(scopeId) ?? 0;
  if (count >= MAX_EXPLAIN_PER_SCOPE) {
    return false;
  }
  scopeExplainCounts.set(scopeId, count + 1);
  return true;
}

export function resetExplainCaptureCountsForTests(): void {
  scopeExplainCounts.clear();
}

export interface PrismaQueryEvent {
  timestamp: Date;
  query: string;
  params: string;
  duration: number;
  target: string;
}

export interface PrismaQueryEventClient {
  $on(eventType: "query", callback: (event: PrismaQueryEvent) => void): void;
}

export interface RegisterSlowQueryExplainOptions {
  client: PrismaClient;
  logger: Logger;
  slowQueryMs: number;
  analyze?: boolean;
}

export function registerSlowQueryExplainHook(options: RegisterSlowQueryExplainOptions): void {
  const analyze = options.analyze ?? false;
  const queryEventClient = options.client as PrismaClient & PrismaQueryEventClient;

  queryEventClient.$on("query", (event) => {
    if (event.duration < options.slowQueryMs) {
      return;
    }
    if (!isExplainEligibleSql(event.query)) {
      return;
    }

    const aggregator = getDbQueryAggregator();
    const scopeId = aggregator?.getScopeId();
    if (!scopeId || !canCaptureExplainForScope(scopeId)) {
      return;
    }

    const params = parsePrismaQueryParams(event.params);
    const sqlFingerprint = fingerprintSql(event.query);

    void runExplainCapture(options.client, event.query, params, analyze)
      .then((capture) => {
        if (!capture) {
          return;
        }
        options.logger.warn(
          {
            event: "database.query.explain",
            scope_id: scopeId,
            scope_type: aggregator?.getScopeType(),
            sql_fingerprint: sqlFingerprint,
            duration_ms: event.duration,
            explain_analyze: analyze,
            planning_time_ms: capture.planningTimeMs,
            plan_summary: capture.planSummary,
            index_names: capture.indexNames,
            explain_plan: capture.sanitizedPlan,
          },
          "database.query.explain",
        );
      })
      .catch((error: unknown) => {
        options.logger.error(
          {
            event: "database.query.explain_failed",
            scope_id: scopeId,
            sql_fingerprint: sqlFingerprint,
            err: error,
          },
          "database.query.explain_failed",
        );
      });
  });
}
