-- Sprint 8 context delivery + rendering layer

CREATE TABLE "context_render_operations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "workspace_id" UUID NOT NULL,
    "delivery_id" TEXT NOT NULL,
    "retrieval_trace_id" TEXT NOT NULL,
    "compression_trace_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "context_render_operations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "context_render_operations_workspace_id_idx" ON "context_render_operations"("workspace_id");
CREATE INDEX "context_render_operations_delivery_id_idx" ON "context_render_operations"("delivery_id");
CREATE INDEX "context_render_operations_retrieval_trace_id_idx" ON "context_render_operations"("retrieval_trace_id");
CREATE INDEX "context_render_operations_compression_trace_id_idx" ON "context_render_operations"("compression_trace_id");

ALTER TABLE "context_render_operations" ADD CONSTRAINT "context_render_operations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
