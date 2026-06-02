import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");

loadEnv({ path: resolve(repoRoot, ".env") });
loadEnv({ path: resolve(scriptDir, "../.env") });

if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Copy .env.example to the repo root:\n  copy .env.example .env",
  );
  process.exit(1);
}

const prismaArgs = process.argv.slice(2);

if (prismaArgs.length === 0) {
  console.error("Usage: node scripts/with-env.mjs <prisma-command> [args...]");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...prismaArgs], {
  stdio: "inherit",
  env: process.env,
  shell: true,
  cwd: resolve(scriptDir, ".."),
});

process.exit(result.status ?? 1);
