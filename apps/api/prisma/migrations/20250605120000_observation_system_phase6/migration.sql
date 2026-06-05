-- Phase 6: domain observation filters for scoped observation retrieval
ALTER TABLE "domains" ADD COLUMN "observation_filters" JSONB NOT NULL DEFAULT '[]';
