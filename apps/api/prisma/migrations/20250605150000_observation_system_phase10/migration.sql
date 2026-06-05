-- Phase 10: observation memory query index (optional performance gate)
CREATE INDEX IF NOT EXISTS "memories_observation_metadata_gin_idx"
  ON "memories"
  USING gin ("metadata" jsonb_path_ops)
  WHERE "memory_type" = 'observation' AND "archived" = false;
