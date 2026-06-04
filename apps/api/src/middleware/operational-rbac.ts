import type { FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { OperationalRole } from "@memory-middleware/shared-types";
import { recordSecurityEvent } from "../lib/platform-events.js";
import type { AuthContext } from "./auth.js";

const ROLE_RANK: Record<OperationalRole, number> = {
  middleware_admin: 5,
  agency_admin: 4,
  platform_admin: 3,
  workspace_admin: 2,
  workspace_user: 1,
};

const VALID_ROLES = new Set<string>(Object.keys(ROLE_RANK));

export function isOperationalRole(value: string): value is OperationalRole {
  return VALID_ROLES.has(value);
}

export function resolveOperationalRoleFromMembership(input: {
  isMiddlewareAdmin: boolean;
  isPlatformAdmin: boolean;
  agencyId: string | null;
  platformId: string | null;
  membershipRole: string;
  membershipOperationalRole: string | null;
}): OperationalRole {
  if (input.isMiddlewareAdmin || input.isPlatformAdmin) return "middleware_admin";
  if (input.agencyId) return "agency_admin";
  if (input.platformId) return "platform_admin";
  if (
    input.membershipOperationalRole &&
    isOperationalRole(input.membershipOperationalRole)
  ) {
    return input.membershipOperationalRole;
  }
  if (input.membershipRole === "owner" || input.membershipRole === "admin") {
    return "workspace_admin";
  }
  return "workspace_user";
}

export function resolveOperationalRoleForApiKey(
  permissions: AuthContext["permissions"],
): OperationalRole {
  return permissions.includes("admin") ? "workspace_admin" : "workspace_user";
}

export function roleMeetsMinimum(actor: OperationalRole, minimum: OperationalRole): boolean {
  return ROLE_RANK[actor] >= ROLE_RANK[minimum];
}

export type DomainEnginePermission =
  | "domain_read"
  | "domain_write"
  | "package_catalog"
  | "package_workspace"
  | "package_clone"
  | "hard_delete";

const PERMISSION_MIN_ROLE: Record<DomainEnginePermission, OperationalRole> = {
  domain_read: "workspace_user",
  domain_write: "workspace_admin",
  package_catalog: "middleware_admin",
  package_workspace: "workspace_admin",
  package_clone: "platform_admin",
  hard_delete: "middleware_admin",
};

export function permissionMinimumRole(permission: DomainEnginePermission): OperationalRole {
  return PERMISSION_MIN_ROLE[permission];
}

export async function workspaceWithinOperationalScope(
  prisma: PrismaClient,
  auth: AuthContext,
  workspaceId: string,
): Promise<boolean> {
  if (auth.operationalRole === "middleware_admin") return true;

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { platformId: true, platform: { select: { agencyId: true } } },
  });
  if (!workspace) return false;

  if (auth.operationalRole === "platform_admin" && auth.platformId) {
    return workspace.platformId === auth.platformId;
  }
  if (auth.operationalRole === "agency_admin" && auth.agencyId) {
    return workspace.platform.agencyId === auth.agencyId;
  }

  return auth.workspaceId === workspaceId;
}

export function domainEngineWriteRequiresSession(method: string, path: string): boolean {
  if (method === "GET" || method === "HEAD") return false;
  if (path.startsWith("/platform/packages")) return true;
  return (
    path.startsWith("/packages") ||
    path.startsWith("/global-facts") ||
    path.startsWith("/domains") ||
    path.startsWith("/domain-facts") ||
    path.startsWith("/instructions")
  );
}

export async function enforceOperationalPermission(
  request: FastifyRequest,
  reply: FastifyReply,
  permission: DomainEnginePermission,
  opts?: { workspaceId?: string },
): Promise<boolean> {
  const auth = request.auth;
  if (!auth?.operationalRole) {
    reply.status(401).send({ error: "Authentication required" });
    return false;
  }

  const minimum = permissionMinimumRole(permission);
  if (!roleMeetsMinimum(auth.operationalRole, minimum)) {
    await recordSecurityEvent(request.server.prisma, {
      workspaceId: auth.workspaceId,
      eventType: "permission_denied",
      ...(auth.userId ? { actorUserId: auth.userId } : {}),
      metadata: {
        path: request.url.split("?")[0],
        operationalRole: auth.operationalRole,
        required: minimum,
        permission,
      },
    });
    reply.status(403).send({
      error: "Insufficient operational role",
      code: "permission_denied",
      operationalRole: auth.operationalRole,
      required: minimum,
    });
    return false;
  }

  if (permission === "package_catalog") {
    return true;
  }

  const workspaceId = opts?.workspaceId;
  if (workspaceId) {
    const inScope = await workspaceWithinOperationalScope(
      request.server.prisma,
      auth,
      workspaceId,
    );
    if (!inScope) {
      await recordSecurityEvent(request.server.prisma, {
        workspaceId: auth.workspaceId,
        eventType: "permission_denied",
        ...(auth.userId ? { actorUserId: auth.userId } : {}),
        metadata: {
          path: request.url.split("?")[0],
          operationalRole: auth.operationalRole,
          requestedWorkspace: workspaceId,
        },
      });
      reply.status(403).send({ error: "Workspace scope violation" });
      return false;
    }

    if (
      auth.operationalRole !== "middleware_admin" &&
      auth.operationalRole !== "agency_admin" &&
      auth.operationalRole !== "platform_admin" &&
      auth.workspaceId !== workspaceId
    ) {
      reply.status(403).send({ error: "Workspace scope violation" });
      return false;
    }
  }

  return true;
}
