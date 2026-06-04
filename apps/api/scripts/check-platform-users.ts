import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";

const scriptDir = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(scriptDir, "../../../.env") });

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const users = await prisma.platformUser.findMany({
    include: { memberships: { include: { workspace: true } } },
  });
  console.log(`platform_users: ${users.length}`);
  for (const u of users) {
    console.log({
      email: u.email,
      supabaseUserId: u.supabaseUserId,
      memberships: u.memberships.map((m) => ({
        workspaceId: m.workspaceId,
        name: m.workspace.name,
        role: m.role,
      })),
      isPlatformAdmin: u.isPlatformAdmin,
    });
  }
}

main()
  .finally(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
