import { type PrismaClient } from "@prisma/client";
import type { PipelineStore } from "@memory-middleware/ingestion";
import type { IngestionTraceView, SourceTruthView } from "@memory-middleware/shared-types";
export declare function createPipelineStore(prisma: PrismaClient): PipelineStore;
export declare function getIngestionTrace(prisma: PrismaClient, traceId: string): Promise<IngestionTraceView | null>;
export declare function getSourceTruth(prisma: PrismaClient, traceId: string): Promise<SourceTruthView | null>;
//# sourceMappingURL=ingestion-store.d.ts.map