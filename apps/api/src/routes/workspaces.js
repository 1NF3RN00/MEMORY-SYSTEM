export async function registerWorkspaceRoutes(app) {
    app.get("/workspaces/default", async (_request, reply) => {
        const workspace = await app.prisma.workspace.findUnique({
            where: { slug: "default" },
        });
        if (!workspace) {
            return reply.status(404).send({
                error: "Default workspace not found. Run: npm run db:seed",
            });
        }
        return {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
        };
    });
}
//# sourceMappingURL=workspaces.js.map