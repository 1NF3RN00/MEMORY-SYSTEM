/**
 * Register observation-system package manifests in the platform catalog.
 *
 * Usage (from repo root):
 *   npm run package-catalog:seed
 *
 * Requires DATABASE_URL in .env. Does not install into workspaces — only
 * registers PackageDefinition rows for POST /packages/install with packageKey.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import type { PackageManifest } from "@memory-middleware/shared-types";
import { createPrismaDomainEngineStore } from "../src/lib/domain-engine/index.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
loadEnv({ path: resolve(repoRoot, ".env") });

const PACKAGE_KEYS = [
  "marketing-intelligence",
  "seo",
  "social-growth",
  "competitive-intelligence",
] as const;

function loadManifest(packageKey: (typeof PACKAGE_KEYS)[number]): PackageManifest {
  const path = resolve(
    repoRoot,
    "packages/package-manifests",
    packageKey,
    "manifest.json",
  );
  return JSON.parse(readFileSync(path, "utf8")) as PackageManifest;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const store = createPrismaDomainEngineStore(prisma);

  try {
    for (const packageKey of PACKAGE_KEYS) {
      const manifest = loadManifest(packageKey);
      const record = await store.upsertPackageDefinition(manifest, true);
      console.log(`Registered ${record.packageKey} v${record.version} (${record.packageDefinitionId})`);
    }
    console.log("Package catalog seed complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
