/**
 * Optional Playwright HAR capture for dashboard home load.
 *
 * Records Fetch/XHR during a hard navigation to `/`, sanitizes secrets, and writes
 * JSON + sanitized HAR artifacts under sprint-32/runs/.
 *
 * Prerequisites:
 *   - API running (npm run dev:api)
 *   - Dashboard running (npm run dev:dashboard) OR set DASHBOARD_URL to preview/prod
 *   - Playwright Chromium: npx playwright install chromium
 *
 * Usage:
 *   npm run perf:bench-dashboard-har
 *   npx tsx scripts/benchmark-dashboard-har.ts --dashboard-url http://localhost:5173
 */
import { config as loadEnv } from "dotenv";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AUDIT_REFERENCE } from "./benchmark-dashboard-load.js";
import { sanitizeHar, summarizeHar, type HarLog } from "./benchmark-dashboard-har-sanitize.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
loadEnv({ path: resolve(repoRoot, ".env") });

async function importPlaywright(): Promise<typeof import("playwright")> {
  try {
    return await import("playwright");
  } catch {
    throw new Error(
      "Playwright is not installed. Run: npm install --no-save playwright@1.52.0 && npx playwright install chromium",
    );
  }
}

export interface HarCaptureReport {
  generatedAt: string;
  measurementMode: "playwright_har";
  dashboardUrl: string;
  strictModeWarning: string;
  harSummary: ReturnType<typeof summarizeHar>;
  auditReference: typeof AUDIT_REFERENCE;
  artifacts: {
    harPath: string;
    sanitizedHarPath: string;
  };
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

export async function captureDashboardHar(options?: {
  dashboardUrl?: string;
  outputDir?: string;
  waitMs?: number;
}): Promise<HarCaptureReport> {
  const args = parseArgs(process.argv.slice(2));
  const dashboardUrl = (
    options?.dashboardUrl ??
    args.get("dashboard-url") ??
    process.env.DASHBOARD_URL ??
    "http://localhost:5173"
  ).replace(/\/$/, "");

  const outputDir = resolve(
    repoRoot,
    options?.outputDir ??
      args.get("output-dir") ??
      "docs/performance-improvments/sprint-32-dashboard-load-measurement-harness/runs",
  );
  mkdirSync(outputDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const harPath = resolve(outputDir, `dashboard-har-${timestamp}.har`);
  const sanitizedHarPath = resolve(outputDir, `dashboard-har-${timestamp}.sanitized.har`);

  const playwright = await importPlaywright();
  const { chromium } = playwright;
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    recordHar: { path: harPath, mode: "minimal" },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${dashboardUrl}/`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {
      // polling endpoints may prevent true idle; continue with fixed wait
    });
    const waitMs = Number(options?.waitMs ?? args.get("wait-ms") ?? 5_000);
    await page.waitForTimeout(waitMs);
  } finally {
    await context.close();
    await browser.close();
  }

  const rawHar = JSON.parse(readFileSync(harPath, "utf8")) as HarLog;
  const sanitized = sanitizeHar(rawHar);
  writeFileSync(sanitizedHarPath, JSON.stringify(sanitized, null, 2), "utf8");

  const harSummary = summarizeHar(sanitized);

  return {
    generatedAt: new Date().toISOString(),
    measurementMode: "playwright_har",
    dashboardUrl,
    strictModeWarning:
      dashboardUrl.includes("5173") || dashboardUrl.includes("localhost")
        ? AUDIT_REFERENCE.strictModeNote
        : "Production/preview build — StrictMode double-mount does not apply.",
    harSummary,
    auditReference: AUDIT_REFERENCE,
    artifacts: {
      harPath,
      sanitizedHarPath,
    },
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const report = await captureDashboardHar();
  console.log("\n=== Dashboard home load HAR capture ===");
  console.log(`Dashboard: ${report.dashboardUrl}`);
  console.log(`API entries: ${report.harSummary.apiEntryCount} / ${report.harSummary.entryCount} total`);
  console.log(
    `Response bytes (HAR bodySize sum): ${(report.harSummary.totalResponseBytes / 1024).toFixed(1)} KB`,
  );
  console.log(`Sanitized HAR: ${report.artifacts.sanitizedHarPath}`);
  console.log(`\n${report.strictModeWarning}`);

  const summaryPath = resolve(
    dirname(report.artifacts.sanitizedHarPath),
    `dashboard-har-${report.generatedAt.replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(summaryPath, JSON.stringify(report, null, 2), "utf8");
  console.log(`Summary JSON: ${summaryPath}`);

  if (args.get("keep-raw-har") !== "true") {
    // Raw HAR may contain secrets before sanitization — remove unless explicitly kept locally.
    try {
      const { unlinkSync } = await import("node:fs");
      unlinkSync(report.artifacts.harPath);
      console.log("Removed unsanitized HAR (use --keep-raw-har true to retain locally).");
    } catch {
      // ignore
    }
  }
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
