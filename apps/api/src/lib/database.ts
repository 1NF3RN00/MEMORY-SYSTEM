import { PrismaClient } from "@prisma/client";
import type { Logger } from "@memory-middleware/observability";

let prisma: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
  }

  return prisma;
}

export async function connectDatabase(logger: Logger): Promise<PrismaClient> {
  const client = getPrismaClient();

  try {
    await client.$connect();
    logger.info({ component: "database" }, "database.connected");
    return client;
  } catch (error) {
    logger.error(
      {
        component: "database",
        err: error,
        hint: "Start PostgreSQL with: npm run docker:up (requires Docker Desktop running)",
      },
      "database.connection_failed",
    );
    throw error;
  }
}

export async function disconnectDatabase(logger: Logger): Promise<void> {
  if (!prisma) {
    return;
  }

  await prisma.$disconnect();
  prisma = undefined;
  logger.info({ component: "database" }, "database.disconnected");
}
