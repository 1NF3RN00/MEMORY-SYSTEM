import type { FastifyInstance } from "fastify";
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

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await registerHealthRoutes(app);
  await registerWorkspaceRoutes(app);
  await registerSearchRoutes(app);
  await registerIngestRoutes(app);
  await registerMemoryRoutes(app);
  await registerIngestionRoutes(app);
  await registerRetrievalRoutes(app);
  await registerPlanningRoutes(app);
  await registerCompressionRoutes(app);
  await registerRelationshipRoutes(app);
  await registerHistorianRoutes(app);
  await registerContextRoutes(app);
  await registerDiagnosticsRoutes(app);
}
