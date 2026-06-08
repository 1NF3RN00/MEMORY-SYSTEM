import type { FastifyInstance } from "fastify";

import { createOpenAiEmbeddingClient } from "@memory-middleware/ingestion";
import { runWithLlmCallAsync } from "@memory-middleware/observability";

import {

  emitObservationEvent,

  OBSERVATION_EVENT_TYPES,

  storeObservationBatch,

} from "@memory-middleware/observation-ingestion";

import {

  createApifyClient,

  getApifyRunStatus,

  getRuntimeProvider,

  listRuntimeProviders,

  validateCollectionParams,

} from "@memory-middleware/observation-providers";

import {

  listMetrics,

  listProviders,

  validateObservation,

} from "@memory-middleware/observation-registry";

import type { CollectInput, Observation } from "@memory-middleware/shared-types";

import { isUlid, newUlid } from "@memory-middleware/shared-types";

import { loadEnv } from "../config/env.js";

import { createObservationIngestionStore } from "../lib/observation-store.js";

import { enforceWorkspaceScope } from "../middleware/auth.js";

import { enforceOperationalPermission } from "../middleware/operational-rbac.js";



function hasIngestPermission(request: { auth?: { permissions?: string[]; operationalRole?: string } }): boolean {

  const auth = request.auth;

  if (!auth) return false;

  if (auth.operationalRole === "workspace_admin" || auth.operationalRole === "middleware_admin") {

    return true;

  }

  return auth.permissions?.includes("ingest") ?? false;

}



export async function registerObservationProviderRoutes(app: FastifyInstance): Promise<void> {

  app.get("/observation-providers", async () => {

    const definitions = listProviders();

    const runnable = new Set(listRuntimeProviders().map((provider) => provider.definition.providerKey));



    return {

      providers: definitions.map((provider) => ({

        providerKey: provider.providerKey,

        name: provider.name,

        description: provider.description,

        categories: provider.categories,

        collectionInputSchema: provider.collectionInputSchema,

        runnable: runnable.has(provider.providerKey),

      })),

    };

  });



  app.get<{

    Querystring: { providerKey?: string; categoryKey?: string };

  }>("/observation-metrics", async (request) => {

    const metricFilter: { providerKey?: string; categoryKey?: string } = {};
    if (request.query.providerKey) metricFilter.providerKey = request.query.providerKey;
    if (request.query.categoryKey) metricFilter.categoryKey = request.query.categoryKey;
    const metrics = listMetrics(metricFilter);



    return {

      metrics: metrics.map((metric) => ({

        metricKey: metric.metricKey,

        categoryKey: metric.categoryKey,

        providerKey: metric.providerKey,

        valueType: metric.valueType,

        unit: metric.unit,

        description: metric.description,

      })),

    };

  });

  app.get<{
    Params: { providerKey: string; runId: string };
  }>("/observation-providers/:providerKey/runs/:runId", async (request, reply) => {
    const env = loadEnv();
    if (!env.APIFY_API_TOKEN) {
      return reply.status(503).send({ error: "APIFY_API_TOKEN is not configured" });
    }

    const provider = getRuntimeProvider(request.params.providerKey);
    if (!provider) {
      return reply.status(404).send({ error: `Provider not available: ${request.params.providerKey}` });
    }

    const client = createApifyClient(env.APIFY_API_TOKEN);
    const status = await getApifyRunStatus(client, request.params.runId);

    return {
      providerKey: request.params.providerKey,
      runId: status.runId,
      status: status.status,
      ...(status.datasetId ? { datasetId: status.datasetId } : {}),
      ...(status.itemCount !== undefined ? { itemCount: status.itemCount } : {}),
    };
  });

  app.post<{

    Params: { providerKey: string };

    Body: {

      workspaceId: string;

      businessId?: string;

      competitorId?: string;

      params: Record<string, unknown>;

    };

  }>("/observation-providers/:providerKey/collect", async (request, reply) => {
    return runWithLlmCallAsync(request.llmCallCollector, async () => {

    const { providerKey } = request.params;

    const { workspaceId, businessId, competitorId, params } = request.body ?? {};



    if (!workspaceId) {

      return reply.status(400).send({ error: "workspaceId is required" });

    }

    if (!params || typeof params !== "object" || Array.isArray(params)) {

      return reply.status(400).send({ error: "params object is required" });

    }



    if (!hasIngestPermission(request)) {

      return reply.status(403).send({ error: "ingest permission required" });

    }

    if (!(await enforceOperationalPermission(request, reply, "domain_write", { workspaceId }))) {

      return;

    }

    if (!enforceWorkspaceScope(request, reply, workspaceId)) return;



    const provider = getRuntimeProvider(providerKey);

    if (!provider) {

      return reply.status(404).send({ error: `Provider not available: ${providerKey}` });

    }



    const paramErrors = validateCollectionParams(provider.definition, params);

    if (paramErrors.length > 0) {

      return reply.status(400).send({ errors: paramErrors });

    }



    const workspace = await app.prisma.workspace.findUnique({ where: { id: workspaceId } });

    if (!workspace) {

      return reply.status(404).send({ error: "Workspace not found" });

    }



    const headerKey = app.traceHeader.toLowerCase();

    const incomingTrace = request.headers[headerKey];

    const traceId =

      typeof incomingTrace === "string" && isUlid(incomingTrace) ? incomingTrace : newUlid();



    await emitObservationEvent(app.events, OBSERVATION_EVENT_TYPES.OBSERVATION_COLLECTION_STARTED, {

      traceId,

      workspaceId,

      observationId: traceId,

      provider: providerKey,

      category: "collection",

      metric: "collect",

      extra: { params },

    });



    try {

      const collectInput: CollectInput = { workspaceId, traceId, params };
      if (businessId) collectInput.businessId = businessId;
      if (competitorId) collectInput.competitorId = competitorId;

      const result = await provider.collect(collectInput);



      const validationErrors: string[] = [];

      const validObservations: Observation[] = [];



      for (let index = 0; index < result.observations.length; index++) {

        const observation = result.observations[index];

        if (!observation) continue;

        const validation = validateObservation(observation);

        if (!validation.valid) {

          validationErrors.push(

            `observations[${index}]: ${validation.errors.join("; ")}`,

          );

          continue;

        }

        validObservations.push(observation);

      }



      if (validationErrors.length > 0) {

        throw new Error(validationErrors.join(" | "));

      }



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

        validObservations,

      );



      await emitObservationEvent(

        app.events,

        OBSERVATION_EVENT_TYPES.OBSERVATION_COLLECTION_COMPLETED,

        {

          traceId,

          workspaceId,

          observationId: batch.observationIds[0] ?? traceId,

          provider: providerKey,

          category: "collection",

          metric: "collect",

          extra: {

            observationCount: batch.observationIds.length,

            rawItemCount: result.rawItemCount,

          },

        },

      );



      return reply.status(200).send({

        providerKey,

        observationCount: batch.observationIds.length,

        observationIds: batch.observationIds,

        collectedAt: result.collectedAt,

      });

    } catch (error) {

      await emitObservationEvent(

        app.events,

        OBSERVATION_EVENT_TYPES.OBSERVATION_COLLECTION_FAILED,

        {

          traceId,

          workspaceId,

          observationId: traceId,

          provider: providerKey,

          category: "collection",

          metric: "collect",

          extra: {

            error: error instanceof Error ? error.message : String(error),

          },

        },

      );



      return reply.status(502).send({

        error: "Collection failed",

        message: error instanceof Error ? error.message : String(error),

      });

    }

    });

  });

}

