import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import type { EventEmitter, Logger } from "@memory-middleware/observability";
export interface ApiDependencies {
    logger: Logger;
    prisma: PrismaClient;
    events: EventEmitter;
    traceHeader: string;
}
export declare function buildApp(deps: ApiDependencies): Promise<FastifyInstance>;
declare module "fastify" {
    interface FastifyInstance {
        prisma: PrismaClient;
        events: EventEmitter;
        appLogger: Logger;
        traceHeader: string;
    }
}
//# sourceMappingURL=app.d.ts.map