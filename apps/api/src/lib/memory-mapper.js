export function mapChunkRow(row) {
    const metadata = (row.metadata ?? {});
    const observability = (row.observability ?? {});
    return {
        id: row.id,
        memoryId: row.memoryId,
        chunkIndex: row.sequence,
        content: row.content,
        tokenCount: row.tokenCount,
        embeddingStatus: row.embeddingStatus,
        metadata,
        observability,
        createdAt: row.createdAt.toISOString(),
    };
}
export function mapMemoryRow(row, chunks) {
    const metadata = row.metadata;
    const scoring = row.scoring;
    const lineage = row.lineage;
    const observability = row.observability;
    return {
        id: row.id,
        workspaceId: row.workspaceId,
        version: row.version,
        ...(row.parentMemoryId ? { parentMemoryId: row.parentMemoryId } : {}),
        memoryType: row.memoryType,
        persistenceMode: row.persistenceMode,
        sourceType: row.sourceType,
        title: row.title,
        normalizedContent: row.normalizedContent,
        ...(row.summary ? { summary: row.summary } : {}),
        chunks: chunks.map(mapChunkRow).sort((a, b) => a.chunkIndex - b.chunkIndex),
        metadata,
        scoring,
        lineage,
        observability: {
            ...observability,
            retrievalEligible: row.retrievalEligible,
            archived: row.archived,
        },
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        ...(row.archivedAt ? { archivedAt: row.archivedAt.toISOString() } : {}),
    };
}
//# sourceMappingURL=memory-mapper.js.map