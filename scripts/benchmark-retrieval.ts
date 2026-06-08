/**
 * Benchmark POST /retrieve latency against a staging-like API (local dev or explicit staging URL).
 *
 * Records timingAudit.totalLatency percentiles and per-stage aggregates from real HTTP samples.
 * Does not hit production unless BENCHMARK_ALLOW_PROD=true.
 *
 * Usage (repo root):
 *   npm run perf:bench-retrieval
 *   npx tsx scripts/benchmark-retrieval.ts --samples 50 --output docs/performance-improvments/sprint-31-production-retrieval-baseline/runs/benchmark.json
 *
 * Environment:
 *   BENCHMARK_API_URL          API origin (default http://localhost:3000)
 *   BENCHMARK_WORKSPACE_ID     Workspace ULID (optional; resolved from /workspaces/default when authed)
 *   BENCHMARK_API_KEY          x-api-key header (optional in local dev without Supabase)
 *   BENCHMARK_AUTH_TOKEN       Bearer token (optional)
 *   BENCHMARK_ALLOW_PROD       Must be "true" for *.vercel.app or known production hosts
 *   BENCHMARK_RETRIEVAL_MODE   Fixed retrieval mode (default precision)
 *   BENCHMARK_TOKEN_BUDGET     Fixed token budget (default 2000)
 *   BENCHMARK_SAMPLES          Sample count (default 50)
 *   BENCHMARK_WARMUP           Warmup requests before measurement (default 2)
 */
import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExecutionTimingAudit } from "@memory-middleware/shared-types";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
loadEnv({ path: resolve(repoRoot, ".env") });

/** Fixed query set — aligned with DEFAULT_RETRIEVAL_BENCHMARK_SET + audit fixed-set guidance. */
export const FIXED_BENCHMARK_QUERIES = [
  "What operational incidents occurred recently?",
  "What are the compliance and policy decisions?",
  "Describe the system architecture and technical design",
  "enterprise pricing policy",
  "customer onboarding workflow steps",
] as const;

/** Mock baseline from pipeline-timing.test.ts / LAT-003 (retrieval stage umbrella). */
export const MOCK_RETRIEVAL_STAGE_MS = 27.54;
/** Mock request total from EXECUTION_TIMING_AUDIT_SYSTEM.md. */
export const MOCK_REQUEST_TOTAL_MS = 29.35;

const PRODUCTION_HOST_PATTERNS = [
  /memory-system-api\.vercel\.app/i,
  /\.vercel\.app$/i,
];

export interface BenchmarkSample {
  index: number;
  query: string;
  httpStatus: number;
  wallClockMs: number;
  timingAudit: ExecutionTimingAudit | null;
  retrievalTraceId: string | null;
  error: string | null;
}

export interface PercentileSummary {
  count: number;
  min: number;
  max: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface StageAggregate {
  stage: string;
  count: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  percentOfRetrievalMean: number | null;
}

export interface BenchmarkReport {
  generatedAt: string;
  environment: {
    apiUrl: string;
    hostClass: "local" | "staging" | "production";
    workspaceId: string;
    retrievalMode: string;
    tokenBudget: number;
    sampleCount: number;
    warmupCount: number;
    querySet: readonly string[];
    openaiConfigured: boolean;
    supabaseConfigured: boolean;
    nodeEnv: string | undefined;
  };
  mockBaseline: {
    retrievalStageMs: number;
    requestTotalMs: number;
    source: string;
  };
  totals: {
    timingAuditTotalLatency: PercentileSummary;
    wallClock: PercentileSummary;
    retrievalStage: PercentileSummary | null;
  };
  comparisonToMock: {
    timingTotalVsMockRequestTotal: {
      p50Ratio: number;
      p95Ratio: number;
      p50DeltaMs: number;
      p95DeltaMs: number;
    };
    retrievalStageVsMockRetrieval: {
      p50Ratio: number | null;
      p95Ratio: number | null;
      p50DeltaMs: number | null;
      p95DeltaMs: number | null;
    } | null;
  };
  stageAggregates: StageAggregate[];
  samples: BenchmarkSample[];
  failures: number;
}

export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0]!;
  const rank = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(rank);
  const upper = Math.ceil(rank);
  if (lower === upper) return sorted[lower]!;
  const weight = rank - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function summarize(values: number[]): PercentileSummary {
  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count,
    min: count ? sorted[0]! : 0,
    max: count ? sorted[count - 1]! : 0,
    mean: count ? sum / count : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
  };
}

export function aggregateStages(samples: BenchmarkSample[]): StageAggregate[] {
  const byStage = new Map<string, number[]>();
  for (const sample of samples) {
    if (!sample.timingAudit) continue;
    for (const stage of sample.timingAudit.stages) {
      const bucket = byStage.get(stage.stage) ?? [];
      bucket.push(stage.durationMs);
      byStage.set(stage.stage, bucket);
    }
  }

  const retrievalMeans = byStage.get("retrieval") ?? null;
  const retrievalMean =
    retrievalMeans && retrievalMeans.length > 0
      ? retrievalMeans.reduce((a, b) => a + b, 0) / retrievalMeans.length
      : null;

  return [...byStage.entries()]
    .map(([stage, durations]) => {
      const summary = summarize(durations);
      return {
        stage,
        count: summary.count,
        meanMs: summary.mean,
        p50Ms: summary.p50,
        p95Ms: summary.p95,
        p99Ms: summary.p99,
        percentOfRetrievalMean:
          stage === "retrieval" || retrievalMean == null || retrievalMean === 0
            ? stage === "retrieval"
              ? 100
              : null
            : (summary.mean / retrievalMean) * 100,
      };
    })
    .sort((a, b) => b.meanMs - a.meanMs);
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string>();
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (token.startsWith("--")) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        args.set(key, next);
        i++;
      } else {
        args.set(key, "true");
      }
    }
  }
  return args;
}

function classifyHost(apiUrl: string): "local" | "staging" | "production" {
  const host = new URL(apiUrl).hostname;
  if (host === "localhost" || host === "127.0.0.1") return "local";
  if (PRODUCTION_HOST_PATTERNS.some((re) => re.test(host))) return "production";
  return "staging";
}

function assertHostAllowed(apiUrl: string): void {
  const hostClass = classifyHost(apiUrl);
  if (hostClass === "production" && process.env.BENCHMARK_ALLOW_PROD !== "true") {
    throw new Error(
      `Refusing production host ${new URL(apiUrl).hostname}. ` +
        "Set BENCHMARK_ALLOW_PROD=true only with explicit approval.",
    );
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const apiKey = process.env.BENCHMARK_API_KEY?.trim();
  const token = process.env.BENCHMARK_AUTH_TOKEN?.trim();
  if (apiKey) headers["x-api-key"] = apiKey;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function resolveWorkspaceId(apiUrl: string): Promise<string> {
  const configured = process.env.BENCHMARK_WORKSPACE_ID?.trim();
  if (configured) return configured;

  const response = await fetch(`${apiUrl}/workspaces/default`, {
    headers: authHeaders(),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Could not resolve workspace (${response.status}). ` +
        "Set BENCHMARK_WORKSPACE_ID or provide BENCHMARK_API_KEY / BENCHMARK_AUTH_TOKEN. " +
        `Body: ${body.slice(0, 200)}`,
    );
  }
  const json = (await response.json()) as { id?: string; workspaceId?: string };
  const id = json.id ?? json.workspaceId;
  if (!id) {
    throw new Error("workspaces/default response missing workspace id");
  }
  return id;
}

async function postRetrieve(
  apiUrl: string,
  workspaceId: string,
  query: string,
  retrievalMode: string,
  tokenBudget: number,
): Promise<{ status: number; body: Record<string, unknown>; wallClockMs: number }> {
  const started = performance.now();
  const response = await fetch(`${apiUrl}/retrieve`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      workspaceId,
      query,
      retrievalMode,
      tokenBudget,
    }),
  });
  const wallClockMs = performance.now() - started;
  const body = (await response.json()) as Record<string, unknown>;
  return { status: response.status, body, wallClockMs };
}

export async function runBenchmark(options?: {
  apiUrl?: string;
  workspaceId?: string;
  samples?: number;
  warmup?: number;
  retrievalMode?: string;
  tokenBudget?: number;
  queries?: readonly string[];
}): Promise<BenchmarkReport> {
  const args = parseArgs(process.argv.slice(2));
  const apiUrl = (options?.apiUrl ?? process.env.BENCHMARK_API_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  assertHostAllowed(apiUrl);

  const samples = Number(
    options?.samples ?? args.get("samples") ?? process.env.BENCHMARK_SAMPLES ?? 50,
  );
  const warmup = Number(
    options?.warmup ?? args.get("warmup") ?? process.env.BENCHMARK_WARMUP ?? 2,
  );
  const retrievalMode =
    options?.retrievalMode ??
    process.env.BENCHMARK_RETRIEVAL_MODE ??
    "precision";
  const tokenBudget = Number(
    options?.tokenBudget ?? process.env.BENCHMARK_TOKEN_BUDGET ?? 2000,
  );
  const queries = options?.queries ?? FIXED_BENCHMARK_QUERIES;

  if (!Number.isFinite(samples) || samples < 1) {
    throw new Error("samples must be a positive number");
  }
  if (!Number.isFinite(tokenBudget) || tokenBudget <= 0) {
    throw new Error("tokenBudget must be a positive number");
  }

  const workspaceId =
    options?.workspaceId ?? (await resolveWorkspaceId(apiUrl));

  for (let i = 0; i < warmup; i++) {
    const query = queries[i % queries.length]!;
    const warm = await postRetrieve(apiUrl, workspaceId, query, retrievalMode, tokenBudget);
    if (warm.status >= 400) {
      throw new Error(
        `Warmup request ${i + 1} failed (${warm.status}): ${JSON.stringify(warm.body).slice(0, 300)}`,
      );
    }
  }

  const collected: BenchmarkSample[] = [];
  for (let i = 0; i < samples; i++) {
    const query = queries[i % queries.length]!;
    const { status, body, wallClockMs } = await postRetrieve(
      apiUrl,
      workspaceId,
      query,
      retrievalMode,
      tokenBudget,
    );
    const timingAudit = (body.timingAudit as ExecutionTimingAudit | undefined) ?? null;
    collected.push({
      index: i,
      query,
      httpStatus: status,
      wallClockMs,
      timingAudit,
      retrievalTraceId:
        typeof body.retrievalTraceId === "string" ? body.retrievalTraceId : null,
      error: typeof body.error === "string" ? body.error : status >= 400 ? "request_failed" : null,
    });
  }

  const successful = collected.filter(
    (s) => s.httpStatus < 400 && s.timingAudit != null,
  );
  const timingTotals = successful.map((s) => s.timingAudit!.totalLatency);
  const wallClocks = successful.map((s) => s.wallClockMs);
  const retrievalStages = successful
    .map((s) => s.timingAudit!.stages.find((st) => st.stage === "retrieval")?.durationMs)
    .filter((v): v is number => typeof v === "number");

  const timingSummary = summarize(timingTotals);
  const wallSummary = summarize(wallClocks);
  const retrievalSummary =
    retrievalStages.length > 0 ? summarize(retrievalStages) : null;

  const report: BenchmarkReport = {
    generatedAt: new Date().toISOString(),
    environment: {
      apiUrl,
      hostClass: classifyHost(apiUrl),
      workspaceId,
      retrievalMode,
      tokenBudget,
      sampleCount: samples,
      warmupCount: warmup,
      querySet: queries,
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
      supabaseConfigured: Boolean(
        process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
      ),
      nodeEnv: process.env.NODE_ENV,
    },
    mockBaseline: {
      retrievalStageMs: MOCK_RETRIEVAL_STAGE_MS,
      requestTotalMs: MOCK_REQUEST_TOTAL_MS,
      source: "pipeline-timing.test.ts / EXECUTION_TIMING_AUDIT_SYSTEM.md",
    },
    totals: {
      timingAuditTotalLatency: timingSummary,
      wallClock: wallSummary,
      retrievalStage: retrievalSummary,
    },
    comparisonToMock: {
      timingTotalVsMockRequestTotal: {
        p50Ratio: timingSummary.p50 / MOCK_REQUEST_TOTAL_MS,
        p95Ratio: timingSummary.p95 / MOCK_REQUEST_TOTAL_MS,
        p50DeltaMs: timingSummary.p50 - MOCK_REQUEST_TOTAL_MS,
        p95DeltaMs: timingSummary.p95 - MOCK_REQUEST_TOTAL_MS,
      },
      retrievalStageVsMockRetrieval: retrievalSummary
        ? {
            p50Ratio: retrievalSummary.p50 / MOCK_RETRIEVAL_STAGE_MS,
            p95Ratio: retrievalSummary.p95 / MOCK_RETRIEVAL_STAGE_MS,
            p50DeltaMs: retrievalSummary.p50 - MOCK_RETRIEVAL_STAGE_MS,
            p95DeltaMs: retrievalSummary.p95 - MOCK_RETRIEVAL_STAGE_MS,
          }
        : null,
    },
    stageAggregates: aggregateStages(successful),
    samples: collected,
    failures: collected.length - successful.length,
  };

  return report;
}

function printSummary(report: BenchmarkReport): void {
  const t = report.totals.timingAuditTotalLatency;
  const r = report.totals.retrievalStage;
  console.log("\n=== POST /retrieve latency benchmark ===");
  console.log(`API: ${report.environment.apiUrl} (${report.environment.hostClass})`);
  console.log(`Workspace: ${report.environment.workspaceId}`);
  console.log(`Samples: ${t.count} ok / ${report.environment.sampleCount} attempted (${report.failures} failed)`);
  console.log(`Config: mode=${report.environment.retrievalMode} tokenBudget=${report.environment.tokenBudget}`);
  console.log("\n--- timingAudit.totalLatency (ms) ---");
  console.log(`p50=${t.p50.toFixed(2)}  p95=${t.p95.toFixed(2)}  p99=${t.p99.toFixed(2)}  mean=${t.mean.toFixed(2)}`);
  if (r) {
    console.log("\n--- retrieval stage (ms) ---");
    console.log(`p50=${r.p50.toFixed(2)}  p95=${r.p95.toFixed(2)}  p99=${r.p99.toFixed(2)}  mean=${r.mean.toFixed(2)}`);
  }
  console.log("\n--- vs mock baseline ---");
  const cmp = report.comparisonToMock;
  console.log(
    `request total: p50 ${cmp.timingTotalVsMockRequestTotal.p50DeltaMs >= 0 ? "+" : ""}${cmp.timingTotalVsMockRequestTotal.p50DeltaMs.toFixed(2)}ms (${cmp.timingTotalVsMockRequestTotal.p50Ratio.toFixed(2)}×), ` +
      `p95 ${cmp.timingTotalVsMockRequestTotal.p95DeltaMs >= 0 ? "+" : ""}${cmp.timingTotalVsMockRequestTotal.p95DeltaMs.toFixed(2)}ms (${cmp.timingTotalVsMockRequestTotal.p95Ratio.toFixed(2)}×) vs mock ${MOCK_REQUEST_TOTAL_MS}ms`,
  );
  if (cmp.retrievalStageVsMockRetrieval) {
    const rs = cmp.retrievalStageVsMockRetrieval;
    console.log(
      `retrieval stage: p50 ${rs.p50DeltaMs! >= 0 ? "+" : ""}${rs.p50DeltaMs!.toFixed(2)}ms (${rs.p50Ratio!.toFixed(2)}×), ` +
        `p95 ${rs.p95DeltaMs! >= 0 ? "+" : ""}${rs.p95DeltaMs!.toFixed(2)}ms (${rs.p95Ratio!.toFixed(2)}×) vs mock ${MOCK_RETRIEVAL_STAGE_MS}ms`,
    );
  }
  console.log("\n--- top stages by mean (ms) ---");
  for (const stage of report.stageAggregates.slice(0, 8)) {
    const pct =
      stage.percentOfRetrievalMean != null
        ? ` (${stage.percentOfRetrievalMean.toFixed(1)}% of retrieval)`
        : "";
    console.log(
      `${stage.stage}: mean=${stage.meanMs.toFixed(2)} p50=${stage.p50Ms.toFixed(2)} p95=${stage.p95Ms.toFixed(2)}${pct}`,
    );
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await runBenchmark();
  printSummary(report);

  const outputArg = args.get("output");
  const defaultOutput = resolve(
    repoRoot,
    "docs/performance-improvments/sprint-31-production-retrieval-baseline/runs",
    `benchmark-${report.generatedAt.replace(/[:.]/g, "-")}.json`,
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
