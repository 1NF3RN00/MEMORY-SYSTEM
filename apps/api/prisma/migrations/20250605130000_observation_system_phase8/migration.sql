-- Phase 8: workflow analysis spec keys
ALTER TABLE "workflows"
  ADD COLUMN IF NOT EXISTS "workflow_key" TEXT,
  ADD COLUMN IF NOT EXISTS "analysis_spec_key" TEXT;
