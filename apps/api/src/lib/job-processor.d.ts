import type { PrismaClient } from "@prisma/client";
import type { EventEmitter } from "@memory-middleware/observability";
export interface JobProcessorOptions {
    prisma: PrismaClient;
    events: EventEmitter;
    openAiApiKey?: string;
}
export declare function processNextIngestionJob(options: JobProcessorOptions): Promise<boolean>;
export declare function expireTemporaryMemories(prisma: PrismaClient, events: EventEmitter): Promise<number>;
//# sourceMappingURL=job-processor.d.ts.map