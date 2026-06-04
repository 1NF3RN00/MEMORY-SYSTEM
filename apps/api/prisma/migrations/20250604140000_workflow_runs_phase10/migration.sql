-- Phase 10: Workflow runs and outputs

CREATE TABLE "workflow_runs" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "output_count" INTEGER NOT NULL DEFAULT 0,
    "generated_fact_ids" JSONB NOT NULL DEFAULT '[]',
    "generated_memory_ids" JSONB NOT NULL DEFAULT '[]',
    "generated_object_ids" JSONB NOT NULL DEFAULT '[]',
    "execution_context" JSONB,
    "archived_at" TIMESTAMP(3),

    CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "workflow_outputs" (
    "id" TEXT NOT NULL,
    "workflow_run_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "output_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_outputs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "workflow_runs_workflow_id_idx" ON "workflow_runs"("workflow_id");
CREATE INDEX "workflow_runs_workspace_id_idx" ON "workflow_runs"("workspace_id");
CREATE INDEX "workflow_outputs_workflow_run_id_idx" ON "workflow_outputs"("workflow_run_id");
CREATE INDEX "workflow_outputs_workspace_id_output_type_idx" ON "workflow_outputs"("workspace_id", "output_type");

ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_outputs" ADD CONSTRAINT "workflow_outputs_workflow_run_id_fkey" FOREIGN KEY ("workflow_run_id") REFERENCES "workflow_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workflow_outputs" ADD CONSTRAINT "workflow_outputs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "global_facts" ADD COLUMN "source_workflow_run_id" TEXT;
ALTER TABLE "domain_facts" ADD COLUMN "source_workflow_run_id" TEXT;
ALTER TABLE "memories" ADD COLUMN "source_workflow_run_id" TEXT;
