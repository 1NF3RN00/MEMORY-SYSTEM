-- Phase 9: package-bundled workflows
ALTER TABLE "workflows"
  ADD COLUMN IF NOT EXISTS "source_package_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "workflows_workspace_id_workflow_key_key"
  ON "workflows" ("workspace_id", "workflow_key")
  WHERE "workflow_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "workflows_source_package_id_idx"
  ON "workflows" ("source_package_id");
