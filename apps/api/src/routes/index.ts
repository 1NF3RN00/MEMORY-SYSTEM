import type { FastifyInstance } from "fastify";
import type { OperationalStreamHub } from "../lib/operational-stream-hub.js";
import { registerOperationalStreamRoutes } from "./operational-stream.js";
import { registerHealthRoutes } from "./health.js";
import { registerIngestRoutes } from "./ingest.js";
import { registerIngestionRoutes } from "./ingestion.js";
import { registerMemoryRoutes } from "./memory.js";
import { registerPlanningRoutes } from "./planning.js";
import { registerRetrievalRoutes } from "./retrieval.js";
import { registerCompressionRoutes } from "./compression.js";
import { registerHistorianRoutes } from "./historian.js";
import { registerRelationshipRoutes } from "./relationships.js";
import { registerContextRoutes } from "./context.js";
import { registerDiagnosticsRoutes } from "./diagnostics.js";
import { registerSearchRoutes } from "./search.js";
import { registerWorkspaceRoutes } from "./workspaces.js";
import { registerAccessRoutes } from "./access.js";
import { registerAuthRoutes } from "./auth.js";
import { registerPlatformRoutes } from "./platform.js";
import { registerPackageRoutes } from "./packages.js";
import { registerDomainRoutes } from "./domains.js";
import { registerObjectRoutes } from "./objects.js";
import { registerWorkflowRoutes } from "./workflows.js";
import { registerObservationRoutes } from "./observations.js";
import { registerObservationProviderRoutes } from "./observation-providers.js";
import { registerPerfTriggerRoutes } from "./perf-trigger.js";

export async function registerRoutes(
  app: FastifyInstance,
  operationalStreamHub: OperationalStreamHub,
): Promise<void> {
  await registerHealthRoutes(app);
  await registerPerfTriggerRoutes(app);
  await registerAccessRoutes(app);
  await registerAuthRoutes(app);
  await registerPlatformRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerOperationalStreamRoutes(app, operationalStreamHub);
  await registerSearchRoutes(app);
  await registerIngestRoutes(app);
  await registerObservationRoutes(app);
  await registerObservationProviderRoutes(app);
  await registerMemoryRoutes(app);
  await registerIngestionRoutes(app);
  await registerRetrievalRoutes(app);
  await registerPlanningRoutes(app);
  await registerCompressionRoutes(app);
  await registerRelationshipRoutes(app);
  await registerHistorianRoutes(app);
  await registerContextRoutes(app);
  await registerDiagnosticsRoutes(app);
  await registerDomainRoutes(app);
  await registerObjectRoutes(app);
  await registerWorkflowRoutes(app);
  await registerPackageRoutes(app);
}
