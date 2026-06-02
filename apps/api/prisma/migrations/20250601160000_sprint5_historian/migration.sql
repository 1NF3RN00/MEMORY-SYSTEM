-- Sprint 5: Operational Historian + Replay System

CREATE TABLE "replay_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "replay_id" TEXT NOT NULL,
    "retrieval_trace_id" TEXT NOT NULL,
    "workspace_id" UUID NOT NULL,
    "integrity_hash" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "retention_mode" TEXT NOT NULL DEFAULT 'operational',
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "replay_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "replay_snapshots_replay_id_key" ON "replay_snapshots"("replay_id");
CREATE INDEX "replay_snapshots_workspace_id_idx" ON "replay_snapshots"("workspace_id");
CREATE INDEX "replay_snapshots_retrieval_trace_id_idx" ON "replay_snapshots"("retrieval_trace_id");
CREATE INDEX "replay_snapshots_retention_mode_idx" ON "replay_snapshots"("retention_mode");
CREATE INDEX "replay_snapshots_created_at_idx" ON "replay_snapshots"("created_at");

ALTER TABLE "replay_snapshots" ADD CONSTRAINT "replay_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
