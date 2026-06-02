import { mapMemoryRow } from "../lib/memory-mapper.js";
export async function registerMemoryRoutes(app) {
    app.get("/memory/:id", async (request, reply) => {
        const memory = await app.prisma.memory.findUnique({
            where: { id: request.params.id },
            include: { chunks: true },
        });
        if (!memory) {
            return reply.status(404).send({ error: "Memory not found" });
        }
        return { memory: mapMemoryRow(memory, memory.chunks) };
    });
    app.get("/memory/:id/chunks", async (request, reply) => {
        const memory = await app.prisma.memory.findUnique({
            where: { id: request.params.id },
        });
        if (!memory) {
            return reply.status(404).send({ error: "Memory not found" });
        }
        const chunks = await app.prisma.memoryChunk.findMany({
            where: { memoryId: request.params.id },
            orderBy: { sequence: "asc" },
        });
        const mapped = mapMemoryRow(memory, chunks);
        return {
            memoryId: memory.id,
            chunks: mapped.chunks,
        };
    });
}
//# sourceMappingURL=memory.js.map