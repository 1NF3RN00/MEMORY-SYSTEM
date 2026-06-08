/**
 * Benchmark home-route dashboard load by mirroring the API fan-out the dashboard performs.
 *
 * Measures request count, per-endpoint payload bytes, and wall-clock latency for:
 *   auth bootstrap → fetchWorkspaceTelemetry (parallel + follow-up) → lite graph
 *
 * Usage (repo root):
 *   npm run perf:bench-dashboard-load
 *   npx tsx scripts/benchmark-dashboard-load.ts --output docs/performance-improvments/sprint-32-dashboard-load-measurement-harness/runs/baseline.json
 *
 * Environment:
 *   BENCHMARK_API_URL          API origin (default http://localhost:3000)
 *   BENCHMARK_WORKSPACE_ID     Workspace ULID (optional; resolved from /workspaces/default)
 *   BENCHMARK_API_KEY          x-api-key header (optional)
 *   BENCHMARK_AUTH_TOKEN       Bearer token (optional)
 *   BENCHMARK_ALLOW_PROD       Must be "true" for *.vercel.app hosts
 *   BENCHMARK_SAMPLES          Repeat full home-load cycles (default 3)
 *   BENCHMARK_SKIP_AUTH        Set "true" when workspace id is preconfigured
 */
import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { summarize, type PercentileSummary } from "./benchmark-retrieval.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
loadEnv({ path: resolve(repoRoot, ".env") });

const PRODUCTION_HOST_PATTERNS = [
  /memory-system-api\.vercel\.app/i,
  /\.vercel\.app$/i,
];

/** Audit reference ranges from DASHBOARD_LOAD_AUDIT.md / FE-002 (pre-sprint quick wins). */
export const AUDIT_REFERENCE = {
  requestCountProd: { min: 12, max: 16 },
  payloadKb: {
    empty: { min: 5, max: 30 },
    moderate: { min: 300, max: 1500 },
    heavy: { min: 2000, max: 5000 },
  },
  strictModeNote:
    "Vite dev wraps the app in React StrictMode (apps/dashboard/src/main.tsx), which re-runs " +
    "mount effects and can ~double Fetch/XHR count vs production build. Use `vite preview` " +
    "or Playwright against a production build for prod-like request counts.",
} as const;

export interface RequestMeasurement {
  phase: "auth" | "telemetry_parallel" | "telemetry_followup" | "graph";
  method: string;
  path: string;
  status: number;
  responseBytes: number;
  durationMs: number;
  error: string | null;
  bodyText?: string;
}

export interface HomeLoadCycle {
  cycleIndex: number;
  requests: RequestMeasurement[];
  totals: {
    requestCount: number;
    successCount: number;
    totalResponseBytes: number;
    authMs: number;
    telemetryParallelMs: number;
    telemetryFollowupMs: number;
    graphMs: number;
    endToEndMs: number;
  };
}

export interface EndpointAggregate {
  pathPattern: string;
  count: number;
  totalBytes: number;
  meanDurationMs: number;
  maxDurationMs: number;
}

export interface DashboardLoadReport {
  generatedAt: string;
  measurementMode: "http_api_mirror";
  environment: {
    apiUrl: string;
    hostClass: "local" | "staging" | "production";
    workspaceId: string;
    sampleCount: number;
    skipAuth: boolean;
    nodeEnv: string | undefined;
    supabaseConfigured: boolean;
  };
  auditReference: typeof AUDIT_REFERENCE;
  cycles: HomeLoadCycle[];
  aggregates: {
    requestCount: PercentileSummary;
    totalResponseBytes: PercentileSummary;
    totalResponseKb: PercentileSummary;
    endToEndMs: PercentileSummary;
  };
  endpointAggregates: EndpointAggregate[];
  interpretation: {
    payloadTier: "empty" | "moderate" | "heavy" | "worst";
    withinAuditRequestRange: boolean | null;
    withinAuditPayloadRange: boolean | null;
  };
}

export function buildTelemetryPaths(workspaceId: string): string[] {
  const ws = encodeURIComponent(workspaceId);
  return [
    `/memory?workspaceId=${ws}&limit=100`,
    `/retrieval?workspaceId=${ws}&limit=50`,
    `/ingestion?workspaceId=${ws}&limit=30`,
    `/compression?workspaceId=${ws}&limit=30`,
    `/context/render?workspaceId=${ws}&limit=20`,
    `/diagnostics/drift?workspaceId=${ws}&limit=50`,
    `/diagnostics/operational?workspaceId=${ws}&limit=100&mode=slim`,
    `/retrieval/heatmaps?workspaceId=${ws}&limit=20`,
    "/health",
  ];
}

export function endpointPattern(path: string): string {
  return path
    .replace(/workspaceId=[^&]+/g, "workspaceId=:ws")
    .replace(/\/compression\/[0-9A-HJKMNP-TV-Z]{26}/gi, "/compression/:id");
}

export function aggregateByEndpoint(requests: RequestMeasurement[]): EndpointAggregate[] {
  const buckets = new Map<
    string,
    { count: number; totalBytes: number; durations: number[] }
  >();

  for (const req of requests) {
    const pattern = endpointPattern(req.path);
    const bucket = buckets.get(pattern) ?? { count: 0, totalBytes: 0, durations: [] };
    bucket.count += 1;
    bucket.totalBytes += req.responseBytes;
    bucket.durations.push(req.durationMs);
    buckets.set(pattern, bucket);
  }

  return [...buckets.entries()]
    .map(([pathPattern, bucket]) => ({
      pathPattern,
      count: bucket.count,
      totalBytes: bucket.totalBytes,
      meanDurationMs:
        bucket.durations.reduce((sum, v) => sum + v, 0) / bucket.durations.length,
      maxDurationMs: Math.max(...bucket.durations),
    }))
    .sort((a, b) => b.totalBytes - a.totalBytes);
}

export function classifyPayloadTier(totalKb: number): DashboardLoadReport["interpretation"]["payloadTier"] {
  if (totalKb <= AUDIT_REFERENCE.payloadKb.empty.max) return "empty";
  if (totalKb <= AUDIT_REFERENCE.payloadKb.moderate.max) return "moderate";
  if (totalKb <= AUDIT_REFERENCE.payloadKb.heavy.max) return "heavy";
  return "worst";
}

function parseArgs(argv: string[]): Map<string, string> {
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
  if (classifyHost(apiUrl) === "production" && process.env.BENCHMARK_ALLOW_PROD !== "true") {
    throw new Error(
      `Refusing production host ${new URL(apiUrl).hostname}. ` +
        "Set BENCHMARK_ALLOW_PROD=true only with explicit approval.",
    );
  }
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const apiKey = process.env.BENCHMARK_API_KEY?.trim();
  const token = process.env.BENCHMARK_AUTH_TOKEN?.trim();
  if (apiKey) headers["x-api-key"] = apiKey;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function measuredGet(
  apiUrl: string,
  path: string,
  phase: RequestMeasurement["phase"],
): Promise<RequestMeasurement> {
  const started = performance.now();
  try {
    const response = await fetch(`${apiUrl}${path}`, { headers: authHeaders() });
    const body = await response.arrayBuffer();
    const bodyText = new TextDecoder().decode(body);
    return {
      phase,
      method: "GET",
      path,
      status: response.status,
      responseBytes: body.byteLength,
      durationMs: performance.now() - started,
      error: response.ok ? null : `HTTP ${response.status}`,
      bodyText,
    };
  } catch (err) {
    return {
      phase,
      method: "GET",
      path,
      status: 0,
      responseBytes: 0,
      durationMs: performance.now() - started,
      error: err instanceof Error ? err.message : String(err),
    };
  }
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
        "Set BENCHMARK_WORKSPACE_ID or provide auth credentials. " +
        `Body: ${body.slice(0, 200)}`,
    );
  }
  const json = (await response.json()) as { id?: string; workspaceId?: string };
  const id = json.id ?? json.workspaceId;
  if (!id) throw new Error("workspaces/default response missing workspace id");
  return id;
}

export async function runHomeLoadCycle(
  apiUrl: string,
  workspaceId: string,
  options?: { skipAuth?: boolean },
): Promise<HomeLoadCycle> {
  const requests: RequestMeasurement[] = [];
  const cycleStarted = performance.now();

  let authMs = 0;
  if (!options?.skipAuth) {
    const auth = await measuredGet(apiUrl, "/workspaces/default", "auth");
    requests.push(auth);
    authMs = auth.durationMs;
  }

  const telemetryPaths = buildTelemetryPaths(workspaceId);
  const parallelStarted = performance.now();
  const parallelResults = await Promise.all(
    telemetryPaths.map((path) => measuredGet(apiUrl, path, "telemetry_parallel")),
  );
  const telemetryParallelMs = performance.now() - parallelStarted;
  requests.push(...parallelResults);

  let telemetryFollowupMs = 0;
  const compressionList = parallelResults.find((r) => r.path.startsWith("/compression?"));
  if (compressionList?.status && compressionList.status < 400 && compressionList.bodyText) {
    try {
      const listJson = JSON.parse(compressionList.bodyText) as {
        traces?: Array<{ compressionTraceId?: string }>;
      };
      const latestId = listJson.traces?.[0]?.compressionTraceId;
      if (latestId) {
        const followupStarted = performance.now();
        const detail = await measuredGet(
          apiUrl,
          `/compression/${latestId}?summary=true`,
          "telemetry_followup",
        );
        telemetryFollowupMs = performance.now() - followupStarted;
        requests.push(detail);
      }
    } catch {
      // follow-up optional; list endpoint already measured
    }
  }

  const graphStarted = performance.now();
  const graph = await measuredGet(
    apiUrl,
    `/relationships/graph?workspaceId=${encodeURIComponent(workspaceId)}&lite=true`,
    "graph",
  );
  const graphMs = performance.now() - graphStarted;
  requests.push(graph);

  const successCount = requests.filter((r) => r.status > 0 && r.status < 400).length;
  const totalResponseBytes = requests.reduce((sum, r) => sum + r.responseBytes, 0);

  return {
    cycleIndex: 0,
    requests,
    totals: {
      requestCount: requests.length,
      successCount,
      totalResponseBytes,
      authMs,
      telemetryParallelMs,
      telemetryFollowupMs,
      graphMs,
      endToEndMs: performance.now() - cycleStarted,
    },
  };
}

function stripBodyText(cycle: HomeLoadCycle): HomeLoadCycle {
  return {
    ...cycle,
    requests: cycle.requests.map(({ bodyText: _bodyText, ...rest }) => rest),
  };
}

export async function runDashboardLoadBenchmark(options?: {
  apiUrl?: string;
  workspaceId?: string;
  samples?: number;
  skipAuth?: boolean;
}): Promise<DashboardLoadReport> {
  const args = parseArgs(process.argv.slice(2));
  const apiUrl = (options?.apiUrl ?? process.env.BENCHMARK_API_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
  assertHostAllowed(apiUrl);

  const samples = Number(
    options?.samples ?? args.get("samples") ?? process.env.BENCHMARK_SAMPLES ?? 3,
  );
  const skipAuth =
    options?.skipAuth ?? (process.env.BENCHMARK_SKIP_AUTH === "true");

  if (!Number.isFinite(samples) || samples < 1) {
    throw new Error("samples must be a positive number");
  }

  const workspaceId = options?.workspaceId ?? (await resolveWorkspaceId(apiUrl));

  const cycles: HomeLoadCycle[] = [];
  for (let i = 0; i < samples; i++) {
    const cycle = await runHomeLoadCycle(apiUrl, workspaceId, { skipAuth: i > 0 ? skipAuth : false });
    cycle.cycleIndex = i;
    cycles.push(cycle);
  }

  const requestCounts = cycles.map((c) => c.totals.requestCount);
  const responseBytes = cycles.map((c) => c.totals.totalResponseBytes);
  const responseKb = responseBytes.map((b) => b / 1024);
  const endToEnd = cycles.map((c) => c.totals.endToEndMs);

  const allRequests = cycles.flatMap((c) => c.requests);
  const endpointAggregates = aggregateByEndpoint(allRequests);

  const meanKb = responseKb.reduce((a, b) => a + b, 0) / responseKb.length;
  const meanRequests = requestCounts.reduce((a, b) => a + b, 0) / requestCounts.length;
  const payloadTier = classifyPayloadTier(meanKb);

  const withinAuditRequestRange =
    meanRequests >= AUDIT_REFERENCE.requestCountProd.min &&
    meanRequests <= AUDIT_REFERENCE.requestCountProd.max;
  const range =
    payloadTier === "empty"
      ? AUDIT_REFERENCE.payloadKb.empty
      : payloadTier === "moderate"
        ? AUDIT_REFERENCE.payloadKb.moderate
        : payloadTier === "heavy"
          ? AUDIT_REFERENCE.payloadKb.heavy
          : { min: 5000, max: 8000 };

  const report: DashboardLoadReport = {
    generatedAt: new Date().toISOString(),
    measurementMode: "http_api_mirror",
    environment: {
      apiUrl,
      hostClass: classifyHost(apiUrl),
      workspaceId,
      sampleCount: samples,
      skipAuth,
      nodeEnv: process.env.NODE_ENV,
      supabaseConfigured: Boolean(
        process.env.SUPABASE_URL?.trim() && process.env.SUPABASE_ANON_KEY?.trim(),
      ),
    },
    auditReference: AUDIT_REFERENCE,
    cycles: cycles.map(stripBodyText),
    aggregates: {
      requestCount: summarize(requestCounts),
      totalResponseBytes: summarize(responseBytes),
      totalResponseKb: summarize(responseKb),
      endToEndMs: summarize(endToEnd),
    },
    endpointAggregates,
    interpretation: {
      payloadTier,
      withinAuditRequestRange,
      withinAuditPayloadRange: meanKb >= range.min && meanKb <= range.max,
    },
  };

  return report;
}

function printSummary(report: DashboardLoadReport): void {
  const kb = report.aggregates.totalResponseKb;
  const reqs = report.aggregates.requestCount;
  const e2e = report.aggregates.endToEndMs;

  console.log("\n=== Dashboard home load benchmark (HTTP API mirror) ===");
  console.log(`API: ${report.environment.apiUrl} (${report.environment.hostClass})`);
  console.log(`Workspace: ${report.environment.workspaceId}`);
  console.log(`Samples: ${report.environment.sampleCount}`);
  console.log(`Mode: ${report.measurementMode}`);
  console.log("\n--- totals ---");
  console.log(
    `requests: mean=${reqs.mean.toFixed(1)} p50=${reqs.p50.toFixed(0)} (audit ref ${AUDIT_REFERENCE.requestCountProd.min}-${AUDIT_REFERENCE.requestCountProd.max})`,
  );
  console.log(
    `payload:  mean=${kb.mean.toFixed(1)} KB p50=${kb.p50.toFixed(1)} KB tier=${report.interpretation.payloadTier}`,
  );
  console.log(
    `latency:  end-to-end p50=${e2e.p50.toFixed(0)}ms p95=${e2e.p95.toFixed(0)}ms`,
  );
  console.log("\n--- top endpoints by bytes ---");
  for (const endpoint of report.endpointAggregates.slice(0, 8)) {
    console.log(
      `${endpoint.pathPattern}: ${(endpoint.totalBytes / 1024).toFixed(1)} KB total, mean=${endpoint.meanDurationMs.toFixed(0)}ms`,
    );
  }
  console.log(`\nStrictMode note: ${AUDIT_REFERENCE.strictModeNote}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await runDashboardLoadBenchmark();
  printSummary(report);

  const outputArg = args.get("output");
  const defaultOutput = resolve(
    repoRoot,
    "docs/performance-improvments/sprint-32-dashboard-load-measurement-harness/runs",
    `dashboard-load-${report.generatedAt.replace(/[:.]/g, "-")}.json`,
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
