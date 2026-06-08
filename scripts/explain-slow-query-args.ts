import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export interface ExplainSlowQueryReport {
  generatedAt: string;
  auditRefs: {
    findingIds: string[];
    sprint: string;
  };
  input: {
    sqlFingerprint: string;
    analyze: boolean;
    source: "cli" | "file";
  };
  capture: unknown;
}

export function parseArgs(argv: string[]): {
  sql?: string;
  file?: string;
  output?: string;
  analyze: boolean;
} {
  let sql: string | undefined;
  let file: string | undefined;
  let output: string | undefined;
  let analyze = true;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--sql" && argv[i + 1]) {
      sql = argv[i + 1];
      i += 1;
    } else if (arg === "--file" && argv[i + 1]) {
      file = argv[i + 1];
      i += 1;
    } else if (arg === "--output" && argv[i + 1]) {
      output = argv[i + 1];
      i += 1;
    } else if (arg === "--no-analyze") {
      analyze = false;
    }
  }

  return { sql, file, output, analyze };
}

export function resolveSqlInput(args: ReturnType<typeof parseArgs>): {
  sql: string;
  source: "cli" | "file";
} {
  if (args.sql) {
    return { sql: args.sql, source: "cli" };
  }
  if (args.file) {
    const filePath = resolve(process.cwd(), args.file);
    return { sql: readFileSync(filePath, "utf8").trim(), source: "file" };
  }
  throw new Error("Provide --sql or --file");
}
