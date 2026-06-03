import type { Prisma, PrismaClient } from "@prisma/client";
import type { EventEmitter } from "@memory-middleware/observability";
import {
  DEFAULT_API_KEY_PERMISSIONS,
  DEFAULT_HISTORIAN_RETENTION_CONFIG,
  DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
  DEFAULT_SYSTEM_CALIBRATION,
  newUlid,
  PLATFORM_EVENT_TYPES,
  type WorkspaceBootstrapStatus,
} from "@memory-middleware/shared-types";
import { generateRawApiKey, hashApiKey, extractKeyPrefix } from "./api-keys.js";
import { createAuthUserAndInvite, isSupabaseConfigured } from "./supabase-admin.js";

export interface ProvisionWorkspaceInput {
  email: string;
  workspaceName: string;
  plan?: "internal" | "alpha" | "production";
  traceId: string;
}

export interface ProvisionWorkspaceResult {
  workspaceId: string;
  userId: string;
  supabaseUserId: string;
  membershipId: string;
  apiKeyId: string;
  rawApiKey: string;
  bootstrap: WorkspaceBootstrapStatus;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `${base}-${newUlid().slice(-6).toLowerCase()}`;
}

function defaultWorkspaceConfig(): Record<string, unknown> {
  return {
    retrieval: DEFAULT_RETRIEVAL_RUNTIME_CONFIG,
    compression: { enabled: true },
    historian: DEFAULT_HISTORIAN_RETENTION_CONFIG,
    observability: { trace_enabled: true, event_logging_enabled: true },
    relationships: { augmentation_enabled: true },
    diagnostics: DEFAULT_SYSTEM_CALIBRATION,
    bootstrap: {
      replayInitialized: true,
      diagnosticsInitialized: true,
      relationshipsInitialized: true,
      observabilityOnline: true,
      retrievalCalibrated: true,
      contextualMappingInitialized: true,
      initializedAt: new Date().toISOString(),
    } satisfies WorkspaceBootstrapStatus,
  };
}

export async function provisionWorkspaceForUser(
  prisma: PrismaClient,
  events: EventEmitter,
  input: ProvisionWorkspaceInput,
): Promise<ProvisionWorkspaceResult> {
  if (!isSupabaseConfigured()) {
    throw new Error("Supabase is not configured");
  }

  const workspaceId = newUlid();
  const userId = newUlid();
  const membershipId = newUlid();
  const apiKeyId = newUlid();
  const rawApiKey = generateRawApiKey();
  const slug = slugify(input.workspaceName);

  const { supabaseUserId } = await createAuthUserAndInvite(input.email);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.platformUser.create({
        data: {
          id: userId,
          supabaseUserId,
          email: input.email.toLowerCase(),
        },
      });

      await tx.workspace.create({
        data: {
          id: workspaceId,
          name: input.workspaceName,
          slug,
          ownerUserId: userId,
          plan: input.plan ?? "alpha",
          config: defaultWorkspaceConfig() as Prisma.InputJsonValue,
        },
      });

      await tx.workspaceMembership.create({
        data: {
          id: membershipId,
          workspaceId,
          userId,
          role: "owner",
        },
      });

      await tx.apiKey.create({
        data: {
          id: apiKeyId,
          workspaceId,
          hashedKey: hashApiKey(rawApiKey),
          keyPrefix: extractKeyPrefix(rawApiKey),
          name: "Default Middleware Key",
          permissions: DEFAULT_API_KEY_PERMISSIONS,
        },
      });

      await tx.snapshot.create({
        data: {
          workspaceId,
          snapshotType: "bootstrap.provisioning",
          payload: {
            workspaceId,
            initialized: defaultWorkspaceConfig().bootstrap,
            traceId: input.traceId,
          } as Prisma.InputJsonValue,
        },
      });

      return { workspaceId, userId, supabaseUserId, membershipId, apiKeyId };
    });

    const bootstrap = defaultWorkspaceConfig().bootstrap as WorkspaceBootstrapStatus;

    await events.emit({
      event_type: PLATFORM_EVENT_TYPES.WORKSPACE_CREATED,
      trace_id: input.traceId,
      workspace_id: workspaceId,
      severity: "info",
      metadata: { email: input.email, plan: input.plan ?? "alpha" },
    });
    await events.emit({
      event_type: PLATFORM_EVENT_TYPES.WORKSPACE_INITIALIZED,
      trace_id: input.traceId,
      workspace_id: workspaceId,
      severity: "info",
      metadata: { bootstrap },
    });
    await events.emit({
      event_type: PLATFORM_EVENT_TYPES.MEMBERSHIP_CREATED,
      trace_id: input.traceId,
      workspace_id: workspaceId,
      severity: "info",
      metadata: { membershipId, role: "owner" },
    });
    await events.emit({
      event_type: PLATFORM_EVENT_TYPES.API_KEY_CREATED,
      trace_id: input.traceId,
      workspace_id: workspaceId,
      severity: "info",
      metadata: { apiKeyId, name: "Default Middleware Key" },
    });

    return { ...result, rawApiKey, bootstrap };
  } catch (error) {
    await events.emit({
      event_type: PLATFORM_EVENT_TYPES.PROVISIONING_FAILED,
      trace_id: input.traceId,
      severity: "error",
      metadata: {
        email: input.email,
        error: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

export function readBootstrapStatus(config: unknown): WorkspaceBootstrapStatus {
  const root = config as Record<string, unknown> | null;
  const bootstrap = root?.bootstrap as Partial<WorkspaceBootstrapStatus> | undefined;
  const status: WorkspaceBootstrapStatus = {
    replayInitialized: bootstrap?.replayInitialized ?? false,
    diagnosticsInitialized: bootstrap?.diagnosticsInitialized ?? false,
    relationshipsInitialized: bootstrap?.relationshipsInitialized ?? false,
    observabilityOnline: bootstrap?.observabilityOnline ?? false,
    retrievalCalibrated: bootstrap?.retrievalCalibrated ?? false,
    contextualMappingInitialized: bootstrap?.contextualMappingInitialized ?? false,
  };
  if (bootstrap?.initializedAt) status.initializedAt = bootstrap.initializedAt;
  return status;
}
