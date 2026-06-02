import { registerHealthRoutes } from "./health.js";
import { registerIngestRoutes } from "./ingest.js";
import { registerIngestionRoutes } from "./ingestion.js";
import { registerMemoryRoutes } from "./memory.js";
import { registerWorkspaceRoutes } from "./workspaces.js";
export async function registerRoutes(app) {
    await registerHealthRoutes(app);
    await registerWorkspaceRoutes(app);
    await registerIngestRoutes(app);
    await registerMemoryRoutes(app);
    await registerIngestionRoutes(app);
}
//# sourceMappingURL=index.js.map