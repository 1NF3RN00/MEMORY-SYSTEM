/**
 * First-time operator bootstrap — provisions YOU as platform admin with a ULID workspace.
 *
 * Usage (from repo root):
 *   npm run platform:bootstrap -- your@email.com
 *
 * Requires in .env:
 *   DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   PASSWORD_SETUP_REDIRECT_URL (e.g. http://localhost:5173/access)
 */
import { config as loadEnv } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { createLogger, createLoggingEventEmitter } from "@memory-middleware/observability";
import { newUlid } from "@memory-middleware/shared-types";
import { createPrismaEventSink } from "../src/lib/event-sink.js";
import {
  isSupabaseConfigured,
  passwordSetupRedirectUrl,
  sendPasswordSetupEmail,
} from "../src/lib/supabase-admin.js";
import { provisionWorkspaceForUser } from "../src/lib/workspace-provision.js";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
loadEnv({ path: resolve(repoRoot, ".env") });

function resolveEmail(): string {
  const arg = process.argv[2]?.trim();
  if (arg && arg.includes("@")) return arg.toLowerCase();
  const fromEnv = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .find(Boolean);
  if (fromEnv) return fromEnv;
  console.error(
    "Usage: npm run platform:bootstrap -- your@email.com\n" +
      "Or set PLATFORM_ADMIN_EMAILS=your@email.com in .env",
  );
  process.exit(1);
}

async function main(): Promise<void> {
  if (!isSupabaseConfigured()) {
    console.error(
      "Supabase is not configured. Add to .env:\n" +
        "  SUPABASE_URL\n" +
        "  SUPABASE_SERVICE_ROLE_KEY\n" +
        "  PASSWORD_SETUP_REDIRECT_URL=http://localhost:5173/access",
    );
    process.exit(1);
  }

  const email = resolveEmail();
  const prisma = new PrismaClient();
  const logger = createLogger({ level: "info", service: "bootstrap" });
  const events = createLoggingEventEmitter({
    logger,
    sink: createPrismaEventSink(prisma),
  });

  const existing = await prisma.platformUser.findUnique({ where: { email } });
  if (existing) {
    await prisma.platformUser.update({
      where: { id: existing.id },
      data: { isPlatformAdmin: true },
    });
    const membership = await prisma.workspaceMembership.findFirst({
      where: { userId: existing.id },
      include: { workspace: true },
    });
    console.log("\n✓ Platform admin flag enabled for existing user");
    console.log(`  Email:        ${email}`);
    console.log(`  User ID:      ${existing.id}`);
    if (membership) {
      console.log(`  Workspace ID: ${membership.workspaceId} (ULID)`);
      console.log(`  Workspace:    ${membership.workspace.name}`);
    } else {
      console.log("  Warning: no workspace membership — run bootstrap with a fresh email or approve via UI.");
    }
    await sendPasswordSetupEmail(email);
    console.log("  Password-setup email sent (check inbox and spam).");
    if (!passwordSetupRedirectUrl()) {
      console.log(
        "  Warning: PASSWORD_SETUP_REDIRECT_URL is not set — email may redirect to the wrong URL.",
      );
    }
    await prisma.$disconnect();
    return;
  }

  const traceId = newUlid();
  const result = await provisionWorkspaceForUser(prisma, events, {
    email,
    workspaceName: "Platform Operations",
    plan: "internal",
    traceId,
  });

  await prisma.platformUser.update({
    where: { id: result.userId },
    data: { isPlatformAdmin: true },
  });

  await prisma.accessRequest.updateMany({
    where: { email, status: "pending" },
    data: {
      status: "approved",
      reviewedAt: new Date(),
      reviewedBy: result.userId,
      provisionedWorkspaceId: result.workspaceId,
    },
  });

  console.log("\n✓ Platform admin provisioned");
  console.log(`  Email:          ${email}`);
  console.log(`  Platform user:  ${result.userId} (ULID)`);
  console.log(`  Workspace ID:   ${result.workspaceId} (ULID)`);
  console.log(`  API key (once): ${result.rawApiKey}`);
  console.log("\nNext steps:");
  console.log("  1. Check your inbox for Supabase password-setup email (also spam)");
  console.log("     Or if rate-limited: npm run platform:set-password -- your@email.com 'YourPassword'");
  console.log("  2. Set password, then log in at /access");
  console.log("  3. Open /admin/provisioning to approve other access requests");
  if (!passwordSetupRedirectUrl()) {
    console.log("\n  Warning: PASSWORD_SETUP_REDIRECT_URL is not set — password email may not redirect correctly.");
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
