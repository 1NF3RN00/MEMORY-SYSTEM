/**
 * Register catalog manifests and install all standard packages into the default workspace.
 *
 * Usage (from repo root):
 *   npm run packages:install-local
 *
 * Requires DATABASE_URL in .env and a seeded default workspace (npm run db:seed).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { installPackage } from "@memory-middleware/domain-engine";
import { createLogger, createLoggingEventEmitter } from "@memory-middleware/observability";
import { PrismaClient } from "@prisma/client";
import type { PackageManifest } from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";
import { createPrismaDomainEngineStore } from "../src/lib/domain-engine/index.js";
import { createPrismaEventSink } from "../src/lib/event-sink.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
loadEnv({ path: resolve(repoRoot, ".env") });

const PACKAGE_KEYS = [
  "seo",
  "competitive-intelligence",
  "social-growth",
  "marketing-intelligence",
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
  const logger = createLogger({ level: "info", service: "packages-install-local" });
  const events = createLoggingEventEmitter({
    logger,
    sink: createPrismaEventSink(prisma),
  });

  try {
    const workspace =
      (await prisma.workspace.findUnique({ where: { slug: "default" } })) ??
      (await prisma.workspace.findFirst({
        where: { archived: false },
        orderBy: { createdAt: "asc" },
      }));
    if (!workspace) {
      throw new Error("No workspace found. Run: npm run db:seed or npm run platform:bootstrap");
    }

    console.log(`Workspace: ${workspace.name} (${workspace.id})`);

    for (const packageKey of PACKAGE_KEYS) {
      const manifest = loadManifest(packageKey);
      await store.upsertPackageDefinition(manifest, true);
      console.log(`Catalog: ${manifest.packageKey} v${manifest.version}`);
    }

    for (const packageKey of PACKAGE_KEYS) {
      try {
        const installed = await installPackage(
          { store, events, traceId: newUlid() },
          { workspaceId: workspace.id, packageKey, failOnConflict: true },
        );
        console.log(`Installed: ${installed.packageKey} v${installed.installedVersion}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Failed: ${packageKey} — ${message}`);
        console.error(
          "If an older manifest is already installed, archive it in Package Manager or run:",
        );
        console.error("  POST /workspaces/default/clear  (with confirmation token)");
      }
    }

    console.log("Local package install finished.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
