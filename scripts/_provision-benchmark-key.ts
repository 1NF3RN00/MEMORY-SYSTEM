/** One-off helper: create a retrieve-scoped API key for benchmark runs. Not part of sprint deliverable. */
import { config as loadEnv } from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { ulid } from "ulid";
import {
  extractKeyPrefix,
  generateRawApiKey,
  hashApiKey,
} from "../apps/api/src/lib/api-keys.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(scriptDir, "../.env") });

const workspaceId = process.argv[2]?.trim();
if (!workspaceId) {
  console.error("Usage: npx tsx scripts/_provision-benchmark-key.ts <workspaceId>");
  process.exit(1);
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const rawApiKey = generateRawApiKey();
  const id = ulid();

  await prisma.apiKey.create({
    data: {
      id,
      workspaceId,
      hashedKey: hashApiKey(rawApiKey),
      keyPrefix: extractKeyPrefix(rawApiKey),
      name: "Sprint-31 retrieval benchmark (ephemeral)",
      permissions: ["retrieve", "diagnostics"],
    },
  });

  console.log(rawApiKey);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
