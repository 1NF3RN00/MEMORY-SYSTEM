import { PrismaClient } from "@prisma/client";
import { newUlid } from "@memory-middleware/shared-types";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.workspace.findUnique({ where: { slug: "default" } });
  if (!existing) {
    await prisma.workspace.create({
      data: {
        id: newUlid(),
        name: "Default Workspace",
        slug: "default",
        plan: "internal",
        config: {
          retrieval: { default_strategy: "deterministic-v1", token_budget_default: 4096 },
          observability: { trace_enabled: true, event_logging_enabled: true },
          bootstrap: {
            replayInitialized: true,
            diagnosticsInitialized: true,
            relationshipsInitialized: true,
            observabilityOnline: true,
            retrievalCalibrated: true,
            contextualMappingInitialized: true,
            initializedAt: new Date().toISOString(),
          },
        },
      },
    });
  }

  console.log("Seeded default workspace (slug: default)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
