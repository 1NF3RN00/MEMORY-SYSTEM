-- Sprint 3: compression operations and lightweight memory relationships

CREATE TABLE "compression_operations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "trace_id" TEXT NOT NULL,
    "retrieval_trace_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "compression_operations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "compression_operations_workspace_id_idx" ON "compression_operations"("workspace_id");
CREATE INDEX "compression_operations_trace_id_idx" ON "compression_operations"("trace_id");
CREATE INDEX "compression_operations_retrieval_trace_id_idx" ON "compression_operations"("retrieval_trace_id");

ALTER TABLE "compression_operations" ADD CONSTRAINT "compression_operations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "memory_relationships" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "source_memory_id" TEXT NOT NULL,
    "target_memory_id" TEXT NOT NULL,
    "relationship_type" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "compression_trace_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memory_relationships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "memory_relationships_workspace_id_source_memory_id_target_memory_id_relationship_type_key" ON "memory_relationships"("workspace_id", "source_memory_id", "target_memory_id", "relationship_type");
CREATE INDEX "memory_relationships_workspace_id_idx" ON "memory_relationships"("workspace_id");
CREATE INDEX "memory_relationships_source_memory_id_idx" ON "memory_relationships"("source_memory_id");
CREATE INDEX "memory_relationships_target_memory_id_idx" ON "memory_relationships"("target_memory_id");
CREATE INDEX "memory_relationships_compression_trace_id_idx" ON "memory_relationships"("compression_trace_id");

ALTER TABLE "memory_relationships" ADD CONSTRAINT "memory_relationships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_relationships" ADD CONSTRAINT "memory_relationships_source_memory_id_fkey" FOREIGN KEY ("source_memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_relationships" ADD CONSTRAINT "memory_relationships_target_memory_id_fkey" FOREIGN KEY ("target_memory_id") REFERENCES "memories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
