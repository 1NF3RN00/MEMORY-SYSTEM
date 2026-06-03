import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiKeyPermission } from "@memory-middleware/shared-types";
import { PLATFORM_EVENT_TYPES } from "@memory-middleware/shared-types";
import { parsePermissions, verifyApiKey } from "../lib/api-keys.js";
import { emitPlatformEvent, recordSecurityEvent } from "../lib/platform-events.js";
import { verifySupabaseJwt, isSupabaseConfigured } from "../lib/supabase-admin.js";

export interface AuthContext {
  kind: "session" | "api_key";
  userId?: string;
  supabaseUserId?: string;
  email?: string;
  workspaceId: string;
  role?: "owner" | "admin" | "member";
  permissions: ApiKeyPermission[];
  apiKeyId?: string;
  isPlatformAdmin?: boolean;
}

declare module "fastify" {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

const PUBLIC_PREFIXES = [
  "/health",
  "/access/request",
  "/auth/",
];

const SESSION_ONLY_PREFIXES = [
  "/platform/",
  "/access/queue",
];

function isPublicRoute(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p));
}

function requiresSessionOnly(url: string): boolean {
  const path = url.split("?")[0] ?? url;
  return SESSION_ONLY_PREFIXES.some((p) => path.startsWith(p));
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
}

function apiKeyHeader(request: FastifyRequest): string | null {
  const key = request.headers["x-api-key"];
  if (typeof key === "string" && key.trim()) return key.trim();
  return null;
}

function queryWorkspaceId(request: FastifyRequest): string | null {
  const q = request.query as Record<string, unknown>;
  const body = request.body as Record<string, unknown> | null;
  const fromQuery = q?.workspaceId;
  const fromBody = body?.workspaceId;
  if (typeof fromQuery === "string" && fromQuery) return fromQuery;
  if (typeof fromBody === "string" && fromBody) return fromBody;
  return null;
}

async function resolveApiKeyAuth(
  request: FastifyRequest,
  rawKey: string,
): Promise<AuthContext | null> {
  const prefix = rawKey.slice(0, 16);
  const candidates = await request.server.prisma.apiKey.findMany({
    where: { keyPrefix: prefix, revoked: false },
    take: 5,
  });

  for (const candidate of candidates) {
    if (!verifyApiKey(rawKey, candidate.hashedKey)) continue;
    await request.server.prisma.apiKey.update({
      where: { id: candidate.id },
      data: { lastUsedAt: new Date() },
    });
    return {
      kind: "api_key",
      workspaceId: candidate.workspaceId,
      permissions: parsePermissions(candidate.permissions),
      apiKeyId: candidate.id,
    };
  }
  return null;
}

async function resolveSessionAuth(
  request: FastifyRequest,
  token: string,
): Promise<AuthContext | null> {
  if (!isSupabaseConfigured()) return null;
  const claims = await verifySupabaseJwt(token);
  if (!claims) return null;

  let platformUser = await request.server.prisma.platformUser.findUnique({
    where: { supabaseUserId: claims.sub },
    include: {
      memberships: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  if (!platformUser || platformUser.memberships.length === 0) return null;

  const adminEmails = syncPlatformAdminEmails(platformUser.email);
  if (adminEmails.includes(platformUser.email.toLowerCase()) && !platformUser.isPlatformAdmin) {
    platformUser = await request.server.prisma.platformUser.update({
      where: { id: platformUser.id },
      data: { isPlatformAdmin: true },
      include: {
        memberships: { orderBy: { createdAt: "asc" }, take: 1 },
      },
    });
  }

  const membership = platformUser.memberships[0]!;
  const ctx: AuthContext = {
    kind: "session",
    userId: platformUser.id,
    supabaseUserId: claims.sub,
    email: platformUser.email,
    workspaceId: membership.workspaceId,
    permissions: ["ingest", "retrieve", "replay", "diagnostics", "relationships", "admin"],
    isPlatformAdmin: platformUser.isPlatformAdmin,
  };
  if (membership.role === "owner" || membership.role === "admin" || membership.role === "member") {
    ctx.role = membership.role;
  }
  return ctx;
}

export function hasPermission(auth: AuthContext, permission: ApiKeyPermission): boolean {
  if (auth.permissions.includes("admin")) return true;
  return auth.permissions.includes(permission);
}

async function attachDevelopmentBypass(
  request: FastifyRequest,
): Promise<boolean> {
  if (process.env.NODE_ENV === "production" || isSupabaseConfigured()) return false;
  const workspace = await request.server.prisma.workspace.findFirst({
    where: { archived: false },
    orderBy: { createdAt: "asc" },
  });
  if (!workspace) return false;
  request.auth = {
    kind: "session",
    workspaceId: workspace.id,
    permissions: ["ingest", "retrieve", "replay", "diagnostics", "relationships", "admin"],
    isPlatformAdmin: true,
  };
  return true;
}

function syncPlatformAdminEmails(email: string): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function registerAuthMiddleware(app: import("fastify").FastifyInstance): Promise<void> {
  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0] ?? request.url;
    if (isPublicRoute(path)) return;

    if (await attachDevelopmentBypass(request)) return;

    const traceId = request.traceId;
    const rawApiKey = apiKeyHeader(request);
    const token = bearerToken(request);

    let auth: AuthContext | null = null;

    if (rawApiKey) {
      auth = await resolveApiKeyAuth(request, rawApiKey);
    } else if (token) {
      auth = await resolveSessionAuth(request, token);
    }

    if (!auth) {
      await recordSecurityEvent(app.prisma, {
        eventType: "auth_failure",
        metadata: { path, reason: "missing_or_invalid_credentials" },
      });
      await emitPlatformEvent(app.events, {
        eventType: PLATFORM_EVENT_TYPES.AUTH_FAILURE,
        traceId,
        severity: "warn",
        metadata: { path },
      });
      return reply.status(401).send({ error: "Authentication required" });
    }

    if (requiresSessionOnly(path) && auth.kind !== "session") {
      return reply.status(403).send({ error: "Session authentication required" });
    }

    const requestedWorkspace = queryWorkspaceId(request);
    if (requestedWorkspace && requestedWorkspace !== auth.workspaceId) {
      await recordSecurityEvent(app.prisma, {
        workspaceId: auth.workspaceId,
        eventType: "permission_denied",
        ...(auth.userId ? { actorUserId: auth.userId } : {}),
        metadata: {
          path,
          requestedWorkspace,
          resolvedWorkspace: auth.workspaceId,
        },
      });
      return reply.status(403).send({ error: "Workspace scope violation" });
    }

    request.auth = auth;

    await emitPlatformEvent(app.events, {
      eventType: PLATFORM_EVENT_TYPES.WORKSPACE_SCOPE_APPLIED,
      traceId,
      workspaceId: auth.workspaceId,
      severity: "debug",
      metadata: { path, authKind: auth.kind },
    });
  });
}

export function enforceWorkspaceScope(
  request: FastifyRequest,
  reply: FastifyReply,
  workspaceId: string,
): boolean {
  if (!request.auth) {
    reply.status(401).send({ error: "Authentication required" });
    return false;
  }
  if (request.auth.workspaceId !== workspaceId) {
    reply.status(403).send({ error: "Workspace scope violation" });
    return false;
  }
  return true;
}
