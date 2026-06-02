import { PrismaClient } from "@prisma/client";
let prisma;
export function getPrismaClient() {
    if (!prisma) {
        prisma = new PrismaClient();
    }
    return prisma;
}
export async function connectDatabase(logger) {
    const client = getPrismaClient();
    try {
        await client.$connect();
        logger.info({ component: "database" }, "database.connected");
        return client;
    }
    catch (error) {
        logger.error({
            component: "database",
            err: error,
            hint: "Start PostgreSQL with: npm run docker:up (requires Docker Desktop running)",
        }, "database.connection_failed");
        throw error;
    }
}
export async function disconnectDatabase(logger) {
    if (!prisma) {
        return;
    }
    await prisma.$disconnect();
    prisma = undefined;
    logger.info({ component: "database" }, "database.disconnected");
}
//# sourceMappingURL=database.js.map