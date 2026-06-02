import { PrismaClient } from "@prisma/client";
import type { Logger } from "@memory-middleware/observability";
export declare function getPrismaClient(): PrismaClient;
export declare function connectDatabase(logger: Logger): Promise<PrismaClient>;
export declare function disconnectDatabase(logger: Logger): Promise<void>;
//# sourceMappingURL=database.d.ts.map