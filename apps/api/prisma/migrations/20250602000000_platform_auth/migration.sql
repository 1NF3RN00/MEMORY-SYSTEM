-- Platform auth, workspace ULID identifiers, and operational access provisioning

-- Workspaces: extend metadata and convert id to TEXT (ULID / operational identifier)
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "owner_user_id" TEXT;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "plan" TEXT NOT NULL DEFAULT 'alpha';
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;

-- Drop FKs referencing workspaces.id before type change
ALTER TABLE "memories" DROP CONSTRAINT IF EXISTS "memories_workspace_id_fkey";
ALTER TABLE "ingestion_jobs" DROP CONSTRAINT IF EXISTS "ingestion_jobs_workspace_id_fkey";
ALTER TABLE "ingestion_traces" DROP CONSTRAINT IF EXISTS "ingestion_traces_workspace_id_fkey";
ALTER TABLE "source_truths" DROP CONSTRAINT IF EXISTS "source_truths_workspace_id_fkey";
ALTER TABLE "retrieval_operations" DROP CONSTRAINT IF EXISTS "retrieval_operations_workspace_id_fkey";
ALTER TABLE "retrieval_plans" DROP CONSTRAINT IF EXISTS "retrieval_plans_workspace_id_fkey";
ALTER TABLE "compression_operations" DROP CONSTRAINT IF EXISTS "compression_operations_workspace_id_fkey";
ALTER TABLE "context_render_operations" DROP CONSTRAINT IF EXISTS "context_render_operations_workspace_id_fkey";
ALTER TABLE "memory_relationships" DROP CONSTRAINT IF EXISTS "memory_relationships_workspace_id_fkey";
ALTER TABLE "compression_artifacts" DROP CONSTRAINT IF EXISTS "compression_artifacts_workspace_id_fkey";
ALTER TABLE "replay_snapshots" DROP CONSTRAINT IF EXISTS "replay_snapshots_workspace_id_fkey";
ALTER TABLE "snapshots" DROP CONSTRAINT IF EXISTS "snapshots_workspace_id_fkey";
ALTER TABLE "event_logs" DROP CONSTRAINT IF EXISTS "event_logs_workspace_id_fkey";

ALTER TABLE "workspaces" ALTER COLUMN "id" DROP DEFAULT;
ALTER TABLE "workspaces" ALTER COLUMN "id" TYPE TEXT USING "id"::text;

ALTER TABLE "memories" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "ingestion_jobs" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "ingestion_traces" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "source_truths" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "retrieval_operations" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "retrieval_plans" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "compression_operations" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "context_render_operations" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "memory_relationships" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "compression_artifacts" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "replay_snapshots" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "snapshots" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;
ALTER TABLE "event_logs" ALTER COLUMN "workspace_id" TYPE TEXT USING "workspace_id"::text;

ALTER TABLE "memories" ADD CONSTRAINT "memories_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingestion_jobs" ADD CONSTRAINT "ingestion_jobs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ingestion_traces" ADD CONSTRAINT "ingestion_traces_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "source_truths" ADD CONSTRAINT "source_truths_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retrieval_operations" ADD CONSTRAINT "retrieval_operations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "retrieval_plans" ADD CONSTRAINT "retrieval_plans_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compression_operations" ADD CONSTRAINT "compression_operations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "context_render_operations" ADD CONSTRAINT "context_render_operations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_relationships" ADD CONSTRAINT "memory_relationships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "compression_artifacts" ADD CONSTRAINT "compression_artifacts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "replay_snapshots" ADD CONSTRAINT "replay_snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Access requests
CREATE TABLE "access_requests" (
    "request_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "company" TEXT,
    "use_case" TEXT,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "provisioned_workspace_id" TEXT,
    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("request_id")
);

CREATE INDEX "access_requests_email_idx" ON "access_requests"("email");
CREATE INDEX "access_requests_status_idx" ON "access_requests"("status");

-- Platform users
CREATE TABLE "platform_users" (
    "id" TEXT NOT NULL,
    "supabase_user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "is_platform_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_users_supabase_user_id_key" ON "platform_users"("supabase_user_id");
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- Workspace memberships
CREATE TABLE "workspace_memberships" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workspace_memberships_workspace_id_user_id_key" ON "workspace_memberships"("workspace_id", "user_id");
CREATE INDEX "workspace_memberships_user_id_idx" ON "workspace_memberships"("user_id");

ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "platform_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- API keys
CREATE TABLE "api_keys" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "hashed_key" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "api_keys_workspace_id_idx" ON "api_keys"("workspace_id");
CREATE INDEX "api_keys_key_prefix_idx" ON "api_keys"("key_prefix");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Security events
CREATE TABLE "security_events" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT,
    "event_type" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'warn',
    "actor_user_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "security_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "security_events_workspace_id_idx" ON "security_events"("workspace_id");
CREATE INDEX "security_events_event_type_idx" ON "security_events"("event_type");
CREATE INDEX "security_events_created_at_idx" ON "security_events"("created_at");
