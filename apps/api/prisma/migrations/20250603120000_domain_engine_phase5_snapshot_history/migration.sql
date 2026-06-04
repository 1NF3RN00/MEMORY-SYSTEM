-- Phase 5: package rollback snapshot history on installed packages
ALTER TABLE "installed_packages" ADD COLUMN IF NOT EXISTS "snapshot_history" JSONB NOT NULL DEFAULT '[]';
