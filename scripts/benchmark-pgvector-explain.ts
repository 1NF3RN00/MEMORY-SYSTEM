/**
 * Sprint-17: EXPLAIN ANALYZE harness for pgvector retrieval queries.
 *
 * Captures real Postgres query plans for the SQL issued by `createPgVectorSearchStore`.
 * Does not change indexes or candidate limits — measurement and documentation only.
 *
 * Usage (repo root):
 *   npm run perf:bench-pgvector-explain
 *   npx tsx scripts/benchmark-pgvector-explain.ts --output docs/performance-improvments/sprint-17-pgvector-index-review/runs/explain.json
 *
 * Environment:
 *   DATABASE_URL or DIRECT_URL   Postgres connection (from .env)
 *   BENCHMARK_WORKSPACE_ID       Workspace ULID (optional; picks workspace with most embedded chunks)
 *   PGVECTOR_EXPLAIN_VARIANTS    Comma-separated subset: base,expanded,semantic_filter (default all)
 */
import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { buildVectorSearchSql } from "../packages/retrieval/src/vector-search-sql.js";
import type { VectorSearchFilter } from "../packages/retrieval/src/vector-retrieval.js";
import { DEFAULT_RETRIEVAL_RUNTIME_CONFIG } from "../packages/shared-types/src/retrieval-contracts.js";
import { FIXED_BENCHMARK_QUERIES } from "./benchmark-retrieval.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
loadEnv({ path: resolve(repoRoot, ".env") });

/** Representative query variants aligned with retrieval modes and LAT-001. */
export const PGVECTOR_EXPLAIN_VARIANTS = [
  {
    id: "base_precision",
    description: "Default precision retrieval — workspace filter, topK=24, no SQL threshold",
    limit: DEFAULT_RETRIEVAL_RUNTIME_CONFIG.vector.topKPrecision,
    filter: (workspaceId: string): VectorSearchFilter => ({ workspaceId }),
  },
  {
    id: "expanded_topk",
    description: "Expanded mode candidate breadth — topK=48",
    limit: DEFAULT_RETRIEVAL_RUNTIME_CONFIG.vector.topKExpanded,
    filter: (workspaceId: string): VectorSearchFilter => ({ workspaceId }),
  },
  {
    id: "semantic_memory_filter",
    description: "Precision with semantic memory_type filter (common package scope)",
    limit: DEFAULT_RETRIEVAL_RUNTIME_CONFIG.vector.topKPrecision,
    filter: (workspaceId: string): VectorSearchFilter => ({
      workspaceId,
      memoryTypes: ["semantic"],
    }),
  },
] as const;

export type PgvectorExplainVariantId = (typeof PGVECTOR_EXPLAIN_VARIANTS)[number]["id"];

/** Normalized EXPLAIN plan node (mapped from Postgres JSON keys). */
export interface ExplainPlanNode {
  nodeType: string;
  relationName?: string;
  indexName?: string;
  actualTotalTime?: number;
  actualRows?: number;
  filter?: string;
  plans?: ExplainPlanNode[];
}

interface PostgresExplainPlanJson {
  "Node Type"?: string;
  "Relation Name"?: string;
  "Index Name"?: string;
  "Actual Total Time"?: number;
  "Actual Rows"?: number;
  Filter?: string;
  Plans?: PostgresExplainPlanJson[];
}

interface PostgresExplainRootJson {
  Plan?: PostgresExplainPlanJson;
  "Planning Time"?: number;
  "Execution Time"?: number;
}

export interface ExplainVariantResult {
  variantId: PgvectorExplainVariantId;
  description: string;
  limit: number;
  filter: VectorSearchFilter;
  executionTimeMs: number | null;
  planningTimeMs: number | null;
  usesHnswIndex: boolean;
  usesSeqScanOnChunks: boolean;
  indexNames: string[];
  planSummary: string;
  rawPlan: ExplainPlanNode[];
}

export interface PgvectorIndexInfo {
  indexName: string;
  indexDef: string;
  tableName: string;
}

export interface WorkspaceStats {
  workspaceId: string;
  embeddedChunkCount: number;
  eligibleMemoryCount: number;
}

export interface PgvectorExplainReport {
  generatedAt: string;
  auditRefs: {
    findingIds: string[];
    latencyFinding: string;
    mockPgvectorMs: number;
  };
  environment: {
    databaseHost: string;
    workspaceId: string;
    sampleQueryText: string;
    embeddingDimensions: number;
    embeddingSource: "existing_chunk" | "unit_vector_fallback";
  };
  workspaceStats: WorkspaceStats;
  indexes: PgvectorIndexInfo[];
  variants: ExplainVariantResult[];
  recommendations: string[];
}

export function mapPostgresExplainPlan(plan: PostgresExplainPlanJson): ExplainPlanNode {
  return {
    nodeType: plan["Node Type"] ?? "Unknown",
    relationName: plan["Relation Name"],
    indexName: plan["Index Name"],
    actualTotalTime: plan["Actual Total Time"],
    actualRows: plan["Actual Rows"],
    filter: plan.Filter,
    plans: (plan.Plans ?? []).map(mapPostgresExplainPlan),
  };
}

export function parseExplainPayload(payload: unknown): {
  plan: ExplainPlanNode | null;
  planningTimeMs: number | null;
  executionTimeMs: number | null;
} {
  const root = Array.isArray(payload) ? (payload[0] as PostgresExplainRootJson | undefined) : undefined;
  if (!root?.Plan) {
    return { plan: null, planningTimeMs: null, executionTimeMs: null };
  }

  return {
    plan: mapPostgresExplainPlan(root.Plan),
    planningTimeMs:
      typeof root["Planning Time"] === "number" ? root["Planning Time"] : null,
    executionTimeMs:
      typeof root["Execution Time"] === "number" ? root["Execution Time"] : null,
  };
}

export function collectPlanNodes(plan: ExplainPlanNode | undefined): ExplainPlanNode[] {
  if (!plan) return [];
  const nodes: ExplainPlanNode[] = [plan];
  for (const child of plan.plans ?? []) {
    nodes.push(...collectPlanNodes(child));
  }
  return nodes;
}

export function analyzeExplainPlan(
  plan: ExplainPlanNode | null,
  executionTimeMs: number | null = null,
): {
  usesHnswIndex: boolean;
  usesSeqScanOnChunks: boolean;
  indexNames: string[];
  planSummary: string;
  executionTimeMs: number | null;
} {
  const nodes = collectPlanNodes(plan ?? undefined);
  const indexNames = [
    ...new Set(
      nodes
        .map((n) => n.indexName)
        .filter((name): name is string => typeof name === "string" && name.length > 0),
    ),
  ];

  const usesHnswIndex = indexNames.some((name) => /hnsw/i.test(name));
  const usesSeqScanOnChunks = nodes.some(
    (n) =>
      n.nodeType === "Seq Scan" &&
      (n.relationName === "memory_chunks" || n.relationName === "mc"),
  );

  const resolvedExecutionTimeMs =
    executionTimeMs ??
    (typeof plan?.actualTotalTime === "number" ? plan.actualTotalTime : null);

  const planSummary = nodes
    .slice(0, 6)
    .map((n) => {
      const parts = [n.nodeType];
      if (n.relationName) parts.push(`on ${n.relationName}`);
      if (n.indexName) parts.push(`via ${n.indexName}`);
      if (typeof n.actualTotalTime === "number") {
        parts.push(`${n.actualTotalTime.toFixed(2)}ms`);
      }
      return parts.join(" ");
    })
    .join(" → ");

  return {
    usesHnswIndex,
    usesSeqScanOnChunks,
    indexNames,
    planSummary,
    executionTimeMs: resolvedExecutionTimeMs,
  };
}

export function buildRecommendations(
  variants: ExplainVariantResult[],
  indexes: PgvectorIndexInfo[],
  stats: WorkspaceStats,
): string[] {
  const recs: string[] = [];
  const hnswPresent = indexes.some((idx) => /hnsw/i.test(idx.indexName));
  const anyHnswUsed = variants.some((v) => v.usesHnswIndex);
  const anySeqScan = variants.some((v) => v.usesSeqScanOnChunks);

  if (hnswPresent && anyHnswUsed) {
    recs.push(
      "HNSW index `memory_chunks_embedding_hnsw_idx` is present and used by at least one representative plan — no index migration required.",
    );
  } else if (hnswPresent && !anyHnswUsed && stats.embeddedChunkCount === 0) {
    recs.push(
      "HNSW index `memory_chunks_embedding_hnsw_idx` is deployed; planner skipped it because the benchmark workspace has zero embedded chunks (empty vector sort). Re-run after ingestion to confirm HNSW selection under LAT-001 load.",
    );
  } else if (hnswPresent && !anyHnswUsed && stats.embeddedChunkCount > 0) {
    recs.push(
      "HNSW index exists but EXPLAIN did not select it. Investigate workspace selectivity and `hnsw.ef_search` before adding alternate indexes.",
    );
  } else if (!hnswPresent) {
    recs.push(
      "No HNSW index found on `memory_chunks.embedding`. Apply migration `20250601140000_sprint2_retrieval_index` before tuning.",
    );
  }

  if (anySeqScan && stats.embeddedChunkCount > 1000) {
    recs.push(
      "Sequential scan on `memory_chunks` observed with >1k embedded chunks — monitor LAT-001 (`vector_search:pgvector`) as data grows.",
    );
  } else if (!anySeqScan) {
    recs.push(
      "No sequential scan on `memory_chunks` in captured plans — index-backed vector ordering appears healthy at current scale.",
    );
  }

  if (stats.embeddedChunkCount === 0) {
    recs.push(
      "Workspace has zero embedded chunks; EXPLAIN timings are not representative of production retrieval load. Re-run after ingestion.",
    );
  }

  recs.push(
    "Do not change `topK` or similarity thresholds without a dedicated sprint — candidate limits affect ranking determinism (anti-objective).",
  );

  return recs;
}

function parseArgs(argv: string[]): Map<string, string> {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args.set(key, next);
      i++;
    } else {
      args.set(key, "true");
    }
  }
  return args;
}

function maskDatabaseHost(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    return "unknown";
  }
}

function unitVector(dimensions: number): number[] {
  const value = 1 / Math.sqrt(dimensions);
  return Array.from({ length: dimensions }, () => value);
}

async function resolveWorkspaceId(prisma: PrismaClient): Promise<string> {
  const configured = process.env.BENCHMARK_WORKSPACE_ID?.trim();
  if (configured) return configured;

  const rows = await prisma.$queryRawUnsafe<Array<{ workspace_id: string; chunk_count: bigint }>>(
    `
      SELECT m.workspace_id, COUNT(*)::bigint AS chunk_count
      FROM memory_chunks mc
      INNER JOIN memories m ON m.id = mc.memory_id
      WHERE mc.embedding_status = 'completed'
        AND mc.embedding IS NOT NULL
        AND m.retrieval_eligible = true
        AND m.archived = false
      GROUP BY m.workspace_id
      ORDER BY chunk_count DESC
      LIMIT 1
    `,
  );

  const workspaceId = rows[0]?.workspace_id;
  if (!workspaceId) {
    const fallback = await prisma.workspace.findFirst({ select: { id: true } });
    if (!fallback?.id) {
      throw new Error(
        "No workspace found. Bootstrap the platform or set BENCHMARK_WORKSPACE_ID.",
      );
    }
    return fallback.id;
  }
  return workspaceId;
}

async function loadSampleEmbedding(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<{ embedding: number[]; source: "existing_chunk" | "unit_vector_fallback" }> {
  const rows = await prisma.$queryRawUnsafe<Array<{ embedding: string }>>(
    `
      SELECT mc.embedding::text AS embedding
      FROM memory_chunks mc
      INNER JOIN memories m ON m.id = mc.memory_id
      WHERE m.workspace_id = $1
        AND mc.embedding_status = 'completed'
        AND mc.embedding IS NOT NULL
      LIMIT 1
    `,
    workspaceId,
  );

  const raw = rows[0]?.embedding;
  if (!raw) {
    return { embedding: unitVector(1536), source: "unit_vector_fallback" };
  }

  const parsed = JSON.parse(raw) as number[];
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { embedding: unitVector(1536), source: "unit_vector_fallback" };
  }
  return { embedding: parsed, source: "existing_chunk" };
}

async function loadWorkspaceStats(
  prisma: PrismaClient,
  workspaceId: string,
): Promise<WorkspaceStats> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ embedded_chunk_count: bigint; eligible_memory_count: bigint }>
  >(
    `
      SELECT
        COUNT(*) FILTER (
          WHERE mc.embedding_status = 'completed' AND mc.embedding IS NOT NULL
        )::bigint AS embedded_chunk_count,
        COUNT(DISTINCT m.id) FILTER (WHERE m.retrieval_eligible = true AND m.archived = false)::bigint AS eligible_memory_count
      FROM memories m
      LEFT JOIN memory_chunks mc ON mc.memory_id = m.id
      WHERE m.workspace_id = $1
    `,
    workspaceId,
  );

  const row = rows[0];
  return {
    workspaceId,
    embeddedChunkCount: Number(row?.embedded_chunk_count ?? 0),
    eligibleMemoryCount: Number(row?.eligible_memory_count ?? 0),
  };
}

async function loadPgvectorIndexes(prisma: PrismaClient): Promise<PgvectorIndexInfo[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{ indexname: string; indexdef: string; tablename: string }>
  >(
    `
      SELECT indexname, indexdef, tablename
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('memory_chunks', 'memories')
        AND (indexdef ILIKE '%vector%' OR indexdef ILIKE '%embedding%')
      ORDER BY tablename, indexname
    `,
  );

  return rows.map((row) => ({
    indexName: row.indexname,
    indexDef: row.indexdef,
    tableName: row.tablename,
  }));
}

async function explainVariant(
  prisma: PrismaClient,
  embedding: number[],
  variant: (typeof PGVECTOR_EXPLAIN_VARIANTS)[number],
  workspaceId: string,
): Promise<ExplainVariantResult> {
  const filter = variant.filter(workspaceId);
  const { sql, params } = buildVectorSearchSql(embedding, filter, variant.limit);
  const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;

  const raw = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": unknown }>>(
    explainSql,
    ...params,
  );

  const payload = raw[0]?.["QUERY PLAN"];
  const parsed = parseExplainPayload(payload);
  const analyzed = analyzeExplainPlan(parsed.plan, parsed.executionTimeMs);

  return {
    variantId: variant.id,
    description: variant.description,
    limit: variant.limit,
    filter,
    executionTimeMs: analyzed.executionTimeMs,
    planningTimeMs: parsed.planningTimeMs,
    usesHnswIndex: analyzed.usesHnswIndex,
    usesSeqScanOnChunks: analyzed.usesSeqScanOnChunks,
    indexNames: analyzed.indexNames,
    planSummary: analyzed.planSummary,
    rawPlan: parsed.plan ? [parsed.plan] : [],
  };
}

export async function runPgvectorExplainBenchmark(options?: {
  variants?: readonly (typeof PGVECTOR_EXPLAIN_VARIANTS)[number]["id"][];
}): Promise<PgvectorExplainReport> {
  const databaseUrl = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or DIRECT_URL is required in .env");
  }

  const variantFilter = new Set(
    options?.variants ??
      (process.env.PGVECTOR_EXPLAIN_VARIANTS?.split(",").map((v) => v.trim()) as
        | PgvectorExplainVariantId[]
        | undefined) ??
      PGVECTOR_EXPLAIN_VARIANTS.map((v) => v.id),
  );

  const selectedVariants = PGVECTOR_EXPLAIN_VARIANTS.filter((v) => variantFilter.has(v.id));
  if (selectedVariants.length === 0) {
    throw new Error("No EXPLAIN variants selected");
  }

  const prisma = new PrismaClient();
  try {
    const workspaceId = await resolveWorkspaceId(prisma);
    const { embedding, source } = await loadSampleEmbedding(prisma, workspaceId);
    const workspaceStats = await loadWorkspaceStats(prisma, workspaceId);
    const indexes = await loadPgvectorIndexes(prisma);

    const variants: ExplainVariantResult[] = [];
    for (const variant of selectedVariants) {
      variants.push(await explainVariant(prisma, embedding, variant, workspaceId));
    }

    const recommendations = buildRecommendations(variants, indexes, workspaceStats);

    return {
      generatedAt: new Date().toISOString(),
      auditRefs: {
        findingIds: ["OP-16", "LAT-001", "MF-001"],
        latencyFinding: "LAT-001",
        mockPgvectorMs: 15.03,
      },
      environment: {
        databaseHost: maskDatabaseHost(databaseUrl),
        workspaceId,
        sampleQueryText: FIXED_BENCHMARK_QUERIES[0],
        embeddingDimensions: embedding.length,
        embeddingSource: source,
      },
      workspaceStats,
      indexes,
      variants,
      recommendations,
    };
  } finally {
    await prisma.$disconnect();
  }
}

function printSummary(report: PgvectorExplainReport): void {
  console.log("\n=== pgvector EXPLAIN ANALYZE (sprint-17) ===");
  console.log(`Host: ${report.environment.databaseHost}`);
  console.log(
    `Workspace: ${report.workspaceStats.workspaceId} (${report.workspaceStats.embeddedChunkCount} embedded chunks)`,
  );
  console.log(`Embedding: ${report.environment.embeddingDimensions}d (${report.environment.embeddingSource})`);

  console.log("\n--- indexes ---");
  for (const idx of report.indexes) {
    console.log(`${idx.tableName}.${idx.indexName}`);
  }

  console.log("\n--- plans ---");
  for (const variant of report.variants) {
    console.log(
      `${variant.variantId}: ${variant.executionTimeMs?.toFixed(2) ?? "?"}ms | hnsw=${variant.usesHnswIndex} seq_scan_chunks=${variant.usesSeqScanOnChunks}`,
    );
    console.log(`  ${variant.planSummary}`);
    if (variant.indexNames.length > 0) {
      console.log(`  indexes: ${variant.indexNames.join(", ")}`);
    }
  }

  console.log("\n--- recommendations ---");
  for (const rec of report.recommendations) {
    console.log(`- ${rec}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await runPgvectorExplainBenchmark();
  printSummary(report);

  const outputArg = args.get("output");
  const defaultOutput = resolve(
    repoRoot,
    "docs/performance-improvments/sprint-17-pgvector-index-review/runs",
    `explain-${report.generatedAt.replace(/[:.]/g, "-")}.json`,
  );
  const outputPath = outputArg ? resolve(repoRoot, outputArg) : defaultOutput;
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`\nWrote artifact: ${outputPath}`);
}

const isMain =
  process.argv[1] != null &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
