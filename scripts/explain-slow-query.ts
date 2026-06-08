/**
 * Sprint-26: EXPLAIN ANALYZE harness for slow-query diagnostics.
 *
 * Complements runtime `database.query.explain` logs (FORMAT JSON by default).
 * Use this script for deeper offline analysis with EXPLAIN ANALYZE + BUFFERS.
 *
 * Usage (repo root):
 *   npm run perf:explain-slow-query -- --sql "SELECT 1"
 *   npx tsx scripts/explain-slow-query.ts --file path/to/query.sql --output runs/explain.json
 *
 * Environment:
 *   DATABASE_URL or DIRECT_URL   Postgres connection (from .env)
 *   DB_EXPLAIN_ON_SLOW           Runtime opt-in (see docs/PERFORMANCE-AUDITS/DATABASE_QUERY_OBSERVABILITY.md)
 */
import { config as loadEnv } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import {
  fingerprintSql,
  runExplainCapture,
  type SlowQueryExplainCapture,
} from "@memory-middleware/observability";
import {
  parseArgs,
  resolveSqlInput,
  type ExplainSlowQueryReport,
} from "./explain-slow-query-args.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "..");
loadEnv({ path: resolve(repoRoot, ".env") });

export type { ExplainSlowQueryReport };

export async function runExplainSlowQueryReport(
  prisma: PrismaClient,
  sql: string,
  analyze: boolean,
  source: "cli" | "file",
): Promise<ExplainSlowQueryReport> {
  const capture: SlowQueryExplainCapture | null = await runExplainCapture(prisma, sql, [], analyze);
  return {
    generatedAt: new Date().toISOString(),
    auditRefs: {
      findingIds: ["OP-25"],
      sprint: "sprint-26-explain-analyze-automation",
    },
    input: {
      sqlFingerprint: fingerprintSql(sql),
      analyze,
      source,
    },
    capture,
  };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const { sql, source } = resolveSqlInput(args);
  const prisma = new PrismaClient();

  try {
    const report = await runExplainSlowQueryReport(prisma, sql, args.analyze, source);
    const serialized = `${JSON.stringify(report, null, 2)}\n`;

    if (args.output) {
      const outputPath = resolve(process.cwd(), args.output);
      mkdirSync(dirname(outputPath), { recursive: true });
      writeFileSync(outputPath, serialized, "utf8");
      console.log(`Wrote ${outputPath}`);
    } else {
      process.stdout.write(serialized);
    }

    if (!report.capture) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  void main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
