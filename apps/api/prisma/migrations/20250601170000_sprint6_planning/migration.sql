-- Sprint 6: retrieval planning artifacts
CREATE TABLE "retrieval_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "plan_id" TEXT NOT NULL,
    "workspace_id" UUID NOT NULL,
    "query" TEXT NOT NULL,
    "retrieval_mode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "plan" JSONB NOT NULL,
    "replay_input" JSONB NOT NULL,
    "stages" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retrieval_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "retrieval_plans_plan_id_key" ON "retrieval_plans"("plan_id");
CREATE INDEX "retrieval_plans_workspace_id_idx" ON "retrieval_plans"("workspace_id");
CREATE INDEX "retrieval_plans_plan_id_idx" ON "retrieval_plans"("plan_id");

ALTER TABLE "retrieval_plans" ADD CONSTRAINT "retrieval_plans_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
