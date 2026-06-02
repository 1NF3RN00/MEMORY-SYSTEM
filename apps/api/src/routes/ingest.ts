import type { FastifyInstance } from "fastify";
import { isUlid, newUlid, type IngestRequestBody } from "@memory-middleware/shared-types";
import { validateIngestRequest } from "@memory-middleware/ingestion";

export async function registerIngestRoutes(app: FastifyInstance): Promise<void> {
  app.post("/ingest", async (request, reply) => {
    const body = request.body as IngestRequestBody;
    const validation = validateIngestRequest(body);

    if (!validation.valid) {
      return reply.status(400).send({ errors: validation.errors });
    }

    const workspace = await app.prisma.workspace.findUnique({
      where: { id: body.workspaceId },
    });

    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const headerKey = app.traceHeader.toLowerCase();
    const incomingTrace = request.headers[headerKey];
    const resolvedTraceId =
      typeof incomingTrace === "string" && isUlid(incomingTrace)
        ? incomingTrace
        : newUlid();

    const persistenceMode = body.persistenceMode ?? "persistent";
    const memoryType = body.memoryType ?? "semantic";

    const inputPayload = {
      content: body.content,
      url: body.url ?? body.sourceUrl,
      title: body.title,
      sourceUrl: body.sourceUrl,
      sourceLabel: body.sourceLabel,
      tags: body.tags,
    };

    const job = await app.prisma.$transaction(async (tx) => {
      await tx.ingestionTrace.create({
        data: {
          id: newUlid(),
          workspaceId: body.workspaceId,
          traceId: resolvedTraceId,
          status: "pending",
          sourceType: body.sourceType,
          persistenceMode,
          stages: [],
        },
      });

      return tx.ingestionJob.create({
        data: {
          id: newUlid(),
          workspaceId: body.workspaceId,
          traceId: resolvedTraceId,
          status: "pending",
          sourceType: body.sourceType,
          persistenceMode,
          memoryType,
          inputPayload,
          useLlmStructuring: body.useLlmStructuring ?? false,
        },
      });
    });

    return reply.status(202).send({
      traceId: resolvedTraceId,
      jobId: job.id,
      status: "pending" as const,
    });
  });
}
