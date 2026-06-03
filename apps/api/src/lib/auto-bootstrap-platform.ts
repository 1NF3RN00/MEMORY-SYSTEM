import type { PrismaClient } from "@prisma/client";
import type { EventEmitter, Logger } from "@memory-middleware/observability";
import { newUlid } from "@memory-middleware/shared-types";
import { isSupabaseConfigured } from "./supabase-admin.js";
import { provisionWorkspaceForUser } from "./workspace-provision.js";

function primaryAdminEmail(): string | null {
  const email = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .find(Boolean);
  return email ?? null;
}

/**
 * When PLATFORM_ADMIN_EMAILS is set and no platform admin exists yet,
 * provisions the first operator (Supabase user + ULID workspace + admin flag).
 * Safe to run on every API cold start — exits immediately if already bootstrapped.
 */
export async function maybeAutoBootstrapPlatformAdmin(
  prisma: PrismaClient,
  events: EventEmitter,
  logger: Logger,
): Promise<void> {
  if (process.env.AUTO_BOOTSTRAP_PLATFORM_ADMIN === "false") return;

  const email = primaryAdminEmail();
  if (!email) return;
  if (!isSupabaseConfigured()) {
    logger.warn(
      { email },
      "platform.auto_bootstrap_skipped_supabase_not_configured",
    );
    return;
  }

  const adminCount = await prisma.platformUser.count({
    where: { isPlatformAdmin: true },
  });
  if (adminCount > 0) return;

  const existing = await prisma.platformUser.findUnique({ where: { email } });
  if (existing) {
    await prisma.platformUser.update({
      where: { id: existing.id },
      data: { isPlatformAdmin: true },
    });
    logger.info(
      { email, userId: existing.id },
      "platform.auto_bootstrap_promoted_existing_user",
    );
    return;
  }

  try {
    const result = await provisionWorkspaceForUser(prisma, events, {
      email,
      workspaceName: "Platform Operations",
      plan: "internal",
      traceId: newUlid(),
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

    logger.info(
      {
        email,
        userId: result.userId,
        workspaceId: result.workspaceId,
        hint: "Password-setup email sent via Supabase if SMTP is configured",
      },
      "platform.auto_bootstrap_completed",
    );
  } catch (error) {
    logger.error(
      {
        err: error,
        email,
        hint: "Run manually: npm run platform:bootstrap -- your@email.com",
      },
      "platform.auto_bootstrap_failed",
    );
  }
}
