import type { FastifyInstance } from "fastify";
import { newUlid, PLATFORM_EVENT_TYPES } from "@memory-middleware/shared-types";
import { emitPlatformEvent } from "../lib/platform-events.js";
import { provisionWorkspaceForUser } from "../lib/workspace-provision.js";

function mapAccessRequest(row: {
  id: string;
  email: string;
  company: string | null;
  useCase: string | null;
  note: string | null;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
}) {
  return {
    requestId: row.id,
    email: row.email,
    company: row.company ?? undefined,
    useCase: row.useCase ?? undefined,
    note: row.note ?? undefined,
    status: row.status as "pending" | "approved" | "rejected",
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString(),
  };
}

export async function registerAccessRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: {
      email?: string;
      company?: string;
      useCase?: string;
      note?: string;
    };
  }>("/access/request", async (request, reply) => {
    const email = request.body?.email?.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      return reply.status(400).send({ error: "Valid email is required" });
    }

    const existing = await app.prisma.accessRequest.findFirst({
      where: { email, status: "pending" },
    });
    if (existing) {
      return reply.status(409).send({ error: "A pending access request already exists for this email" });
    }

    const requestId = newUlid();
    const row = await app.prisma.accessRequest.create({
      data: {
        id: requestId,
        email,
        company: request.body?.company?.trim() || null,
        useCase: request.body?.useCase?.trim() || null,
        note: request.body?.note?.trim() || null,
      },
    });

    await emitPlatformEvent(app.events, {
      eventType: PLATFORM_EVENT_TYPES.ACCESS_REQUESTED,
      traceId: request.traceId,
      metadata: { requestId, email },
    });

    return mapAccessRequest(row);
  });

  async function requirePlatformAdmin(
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply,
  ): Promise<boolean> {
    if (request.auth?.isPlatformAdmin) return true;
    const adminCount = await app.prisma.platformUser.count({
      where: { isPlatformAdmin: true },
    });
    if (adminCount === 0) return true;
    reply.status(403).send({ error: "Platform admin access required" });
    return false;
  }

  app.get("/access/queue", async (request, reply) => {
    if (!(await requirePlatformAdmin(request, reply))) return;

    const status = (request.query as { status?: string }).status ?? "pending";
    const rows = await app.prisma.accessRequest.findMany({
      where: { status },
      orderBy: { createdAt: "asc" },
      take: 100,
    });

    return { requests: rows.map(mapAccessRequest) };
  });

  app.post<{ Params: { requestId: string } }>(
    "/access/queue/:requestId/approve",
    async (request, reply) => {
      if (!(await requirePlatformAdmin(request, reply))) return;

      const row = await app.prisma.accessRequest.findUnique({
        where: { id: request.params.requestId },
      });
      if (!row) return reply.status(404).send({ error: "Access request not found" });
      if (row.status !== "pending") {
        return reply.status(400).send({ error: `Request already ${row.status}` });
      }

      const workspaceName =
        (request.body as { workspaceName?: string } | null)?.workspaceName?.trim() ||
        row.company ||
        `${row.email.split("@")[0]} Operations`;

      try {
        const provisioned = await provisionWorkspaceForUser(app.prisma, app.events, {
          email: row.email,
          workspaceName,
          traceId: request.traceId,
        });

        await app.prisma.accessRequest.update({
          where: { id: row.id },
          data: {
            status: "approved",
            reviewedAt: new Date(),
            ...(request.auth?.userId ? { reviewedBy: request.auth.userId } : {}),
            provisionedWorkspaceId: provisioned.workspaceId,
          },
        });

        await emitPlatformEvent(app.events, {
          eventType: PLATFORM_EVENT_TYPES.ACCESS_APPROVED,
          traceId: request.traceId,
          workspaceId: provisioned.workspaceId,
          metadata: { requestId: row.id, email: row.email },
        });

        return {
          request: mapAccessRequest({
            ...row,
            status: "approved",
            reviewedAt: new Date(),
          }),
          provisioning: {
            workspaceId: provisioned.workspaceId,
            rawApiKey: provisioned.rawApiKey,
            bootstrap: provisioned.bootstrap,
          },
        };
      } catch (error) {
        return reply.status(500).send({
          error: error instanceof Error ? error.message : "Provisioning failed",
        });
      }
    },
  );

  app.post<{ Params: { requestId: string } }>(
    "/access/queue/:requestId/reject",
    async (request, reply) => {
      if (!(await requirePlatformAdmin(request, reply))) return;

      const row = await app.prisma.accessRequest.findUnique({
        where: { id: request.params.requestId },
      });
      if (!row) return reply.status(404).send({ error: "Access request not found" });
      if (row.status !== "pending") {
        return reply.status(400).send({ error: `Request already ${row.status}` });
      }

      const updated = await app.prisma.accessRequest.update({
        where: { id: row.id },
        data: {
          status: "rejected",
          reviewedAt: new Date(),
          ...(request.auth?.userId ? { reviewedBy: request.auth.userId } : {}),
        },
      });

      await emitPlatformEvent(app.events, {
        eventType: PLATFORM_EVENT_TYPES.ACCESS_REJECTED,
        traceId: request.traceId,
        metadata: { requestId: row.id, email: row.email },
      });

      return mapAccessRequest(updated);
    },
  );
}
