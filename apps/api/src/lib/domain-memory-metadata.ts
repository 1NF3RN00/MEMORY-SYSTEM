import type { PrismaClient } from "@prisma/client";

/** Load memory metadata for relationship neighborhood constraint filtering. */
export async function loadMemoryMetadataByIds(
  prisma: PrismaClient,
  memoryIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  if (memoryIds.length === 0) return new Map();

  const rows = await prisma.memory.findMany({
    where: { id: { in: memoryIds } },
    select: { id: true, metadata: true },
  });

  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    map.set(row.id, (row.metadata ?? {}) as Record<string, unknown>);
  }
  return map;
}
