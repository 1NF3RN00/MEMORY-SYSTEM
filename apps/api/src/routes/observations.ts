import type { FastifyInstance } from "fastify";
import {
  normalizeObservationFromRegistry,
  validateObservation,
} from "@memory-middleware/observation-registry";
import { storeObservationBatch } from "@memory-middleware/observation-ingestion";
import { createOpenAiEmbeddingClient } from "@memory-middleware/ingestion";
import { runWithLlmCallAsync } from "@memory-middleware/observability";
import type {
  NormalizedObservation,
  Observation,
  ObservationValidationResult,
} from "@memory-middleware/shared-types";
import {
  matchesObservationQuery,
  memoryRowToNormalizedObservation,
  parseObservationMemoryMetadata,
} from "../lib/observation-query.js";
import { isUlid, newUlid } from "@memory-middleware/shared-types";
import { loadEnv } from "../config/env.js";
import { createObservationIngestionStore } from "../lib/observation-store.js";
import { enforceWorkspaceScope } from "../middleware/auth.js";
import { enforceOperationalPermission } from "../middleware/operational-rbac.js";

type RawObservationInput = {
  observationId?: string;
  metric: string;
  value: unknown;
  source: string;
  timestamp?: string;
  metadata: {
    provider: string;
    category: string;
    metric: string;
    collectedAt?: string;
    businessId?: string;
    competitorId?: string;
    platform?: string;
    unit?: string;
    sourceLabel?: string;
  };
};

function hasIngestPermission(request: { auth?: { permissions?: string[]; operationalRole?: string } }): boolean {
  const auth = request.auth;
  if (!auth) return false;
  if (auth.operationalRole === "workspace_admin" || auth.operationalRole === "middleware_admin") {
    return true;
  }
  return auth.permissions?.includes("ingest") ?? false;
}

function normalizeRawObservations(
  workspaceId: string,
  rows: RawObservationInput[],
): { observations: Observation[]; validationErrors: string[] } {
  const observations: Observation[] = [];
  const validationErrors: string[] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!row) continue;
    const providerKey = row.metadata?.provider;
    if (!providerKey) {
      validationErrors.push(`observations[${index}]: metadata.provider is required`);
      continue;
    }

    let observation: Observation;
    try {
      observation = normalizeObservationFromRegistry(
        {
          observationId: row.observationId,
          workspaceId,
          metric: row.metric,
          value: row.value,
          source: row.source,
          timestamp: row.timestamp,
          metadata: row.metadata,
        },
        providerKey,
        {
          categoryKey: row.metadata.category,
          metricKey: row.metadata.metric,
        },
      );
    } catch (error) {
      validationErrors.push(
        `observations[${index}]: ${error instanceof Error ? error.message : String(error)}`,
      );
      continue;
    }

    if (!observation.observationId) {
      observation.observationId = newUlid();
    }

    const validation = validateObservation(observation);
    if (!validation.valid) {
      validationErrors.push(`observations[${index}]: ${validation.errors.join("; ")}`);
      continue;
    }

    observations.push(observation);
  }

  return { observations, validationErrors };
}

function validateOnly(
  workspaceId: string,
  rows: RawObservationInput[],
): ObservationValidationResult[] {
  const { observations, validationErrors } = normalizeRawObservations(workspaceId, rows);
  const results: ObservationValidationResult[] = observations.map((observation) =>
    validateObservation(observation),
  );

  for (const error of validationErrors) {
    results.push({ valid: false, errors: [error] });
  }

  return results;
}

export async function registerObservationRoutes(app: FastifyInstance): Promise<void> {
  app.get<{
    Querystring: {
      workspaceId?: string;
      provider?: string;
      category?: string;
      metric?: string;
      businessId?: string;
      competitorId?: string;
      collectedAfter?: string;
      collectedBefore?: string;
      limit?: string;
      cursor?: string;
    };
  }>("/observations", async (request, reply) => {
    const { workspaceId } = request.query;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }

    if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const limit = Math.min(Math.max(Number(request.query.limit ?? 50), 1), 200);
    const cursor = request.query.cursor;

    const rows = await app.prisma.memory.findMany({
      where: {
        workspaceId,
        archived: false,
        memoryType: "observation",
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: {
        chunks: {
          orderBy: { sequence: "asc" },
          take: 1,
        },
      },
    });

    const observations: NormalizedObservation[] = [];
    for (const row of rows) {
      if (!parseObservationMemoryMetadata(row.metadata)) continue;
      const normalized = memoryRowToNormalizedObservation(workspaceId, row);
      if (!normalized) continue;
      if (!matchesObservationQuery(normalized, request.query)) continue;
      observations.push(normalized);
      if (observations.length >= limit) break;
    }

    const hasMore = rows.length > limit || observations.length >= limit;
    const nextCursor =
      hasMore && observations.length > 0
        ? observations[observations.length - 1]?.observationId
        : undefined;

    return {
      observations: observations.slice(0, limit),
      ...(nextCursor ? { nextCursor } : {}),
    };
  });

  app.get<{
    Params: { observationId: string };
    Querystring: { workspaceId?: string };
  }>("/observations/:observationId", async (request, reply) => {
    const { workspaceId } = request.query;
    const { observationId } = request.params;
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const row = await app.prisma.memory.findFirst({
      where: {
        id: observationId,
        workspaceId,
        archived: false,
        memoryType: "observation",
      },
      include: {
        chunks: {
          orderBy: { sequence: "asc" },
          take: 1,
        },
      },
    });

    if (!row || !parseObservationMemoryMetadata(row.metadata)) {
      return reply.status(404).send({ error: "Observation not found" });
    }

    const observation = memoryRowToNormalizedObservation(workspaceId, row);
    if (!observation) {
      return reply.status(404).send({ error: "Observation not found" });
    }

    const metadata = row.metadata as Record<string, unknown> | null;
    const ingestionTraceId =
      metadata && typeof metadata.ingestionTraceId === "string"
        ? metadata.ingestionTraceId
        : undefined;

    return {
      observation,
      lineage: {
        memoryId: row.id,
        memoryTitle: row.title,
        createdAt: row.createdAt.toISOString(),
        ...(ingestionTraceId ? { ingestionTraceId } : {}),
      },
    };
  });

  app.post<{
    Body: { workspaceId: string; observations: RawObservationInput[] };
  }>("/observations/validate", async (request, reply) => {
    const { workspaceId, observations } = request.body ?? {};
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!Array.isArray(observations) || observations.length === 0) {
      return reply.status(400).send({ error: "observations array is required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_read", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const results = validateOnly(workspaceId, observations);
    const valid = results.every((result) => result.valid);
    return { valid, results };
  });

  app.post<{
    Body: { workspaceId: string; observations: RawObservationInput[] };
  }>("/observations", async (request, reply) => {
    return runWithLlmCallAsync(request.llmCallCollector, async () => {
    const { workspaceId, observations } = request.body ?? {};
    if (!workspaceId) {
      return reply.status(400).send({ error: "workspaceId is required" });
    }
    if (!Array.isArray(observations) || observations.length === 0) {
      return reply.status(400).send({ error: "observations array is required" });
    }

    if (!hasIngestPermission(request)) {
      return reply.status(403).send({ error: "ingest permission required" });
    }
    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {
      return;
    }
    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;

    const workspace = await app.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      return reply.status(404).send({ error: "Workspace not found" });
    }

    const { observations: normalized, validationErrors } = normalizeRawObservations(
      workspaceId,
      observations,
    );
    if (validationErrors.length > 0) {
      return reply.status(400).send({ errors: validationErrors });
    }

    const headerKey = app.traceHeader.toLowerCase();
    const incomingTrace = request.headers[headerKey];
    const traceId =
      typeof incomingTrace === "string" && isUlid(incomingTrace) ? incomingTrace : newUlid();

    const env = loadEnv();
    const embeddingClient = env.OPENAI_API_KEY
      ? createOpenAiEmbeddingClient(env.OPENAI_API_KEY)
      : null;

    const batch = await storeObservationBatch(
      {
        store: createObservationIngestionStore(app.prisma),
        events: app.events,
        embeddingClient,
        traceId,
      },
      normalized,
    );

    return reply.status(200).send({
      workspaceId,
      traceId,
      observationCount: batch.observationIds.length,
      observationIds: batch.observationIds,
      results: batch.results.map((result) => ({
        observationId: result.observationId,
        memoryId: result.memoryId,
        eventType: result.eventType,
        supersededMemoryIds: result.supersededMemoryIds,
      })),
    });
    });
  });
}
