import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.workspace.upsert({
    where: { slug: "default" },
    update: {},
    create: {
      name: "Default Workspace",
      slug: "default",
      config: {
        retrieval: { default_strategy: "deterministic-v1", token_budget_default: 4096 },
        observability: { trace_enabled: true, event_logging_enabled: true },
      },
    },
  });

  console.log("Seeded default workspace (slug: default)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
