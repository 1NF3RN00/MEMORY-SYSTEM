-- Domain Engine Phase 1: tenancy hierarchy + domain engine tables

-- Default tenancy ULIDs (deterministic backfill)
-- Agency:  01J000000000000000000000001
-- Platform: 01J000000000000000000000002

CREATE TABLE "agencies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "agencies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agencies_slug_key" ON "agencies"("slug");

CREATE TABLE "platforms" (
    "id" TEXT NOT NULL,
    "agency_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "platforms_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platforms_slug_key" ON "platforms"("slug");
CREATE INDEX "platforms_agency_id_idx" ON "platforms"("agency_id");

ALTER TABLE "platforms" ADD CONSTRAINT "platforms_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "agencies" ("id", "name", "slug", "archived", "created_at", "updated_at")
VALUES ('01J000000000000000000000001', 'Default Agency', 'default-agency', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO "platforms" ("id", "agency_id", "name", "slug", "archived", "created_at", "updated_at")
VALUES ('01J000000000000000000000002', '01J000000000000000000000001', 'Default Platform', 'default-platform', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Workspaces → platform
ALTER TABLE "workspaces" ADD COLUMN "platform_id" TEXT;

UPDATE "workspaces" SET "platform_id" = '01J000000000000000000000002' WHERE "platform_id" IS NULL;

ALTER TABLE "workspaces" ALTER COLUMN "platform_id" SET NOT NULL;

CREATE INDEX "workspaces_platform_id_idx" ON "workspaces"("platform_id");

ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Platform user operational roles
ALTER TABLE "platform_users" ADD COLUMN "is_middleware_admin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "platform_users" ADD COLUMN "agency_id" TEXT;
ALTER TABLE "platform_users" ADD COLUMN "platform_id" TEXT;

CREATE INDEX "platform_users_agency_id_idx" ON "platform_users"("agency_id");
CREATE INDEX "platform_users_platform_id_idx" ON "platform_users"("platform_id");

ALTER TABLE "platform_users" ADD CONSTRAINT "platform_users_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "platform_users" ADD CONSTRAINT "platform_users_platform_id_fkey" FOREIGN KEY ("platform_id") REFERENCES "platforms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "platform_users" SET "is_middleware_admin" = true WHERE "is_platform_admin" = true;

-- Workspace membership operational roles
ALTER TABLE "workspace_memberships" ADD COLUMN "operational_role" TEXT;

UPDATE "workspace_memberships" SET "operational_role" = 'workspace_admin' WHERE "role" IN ('owner', 'admin') AND "operational_role" IS NULL;
UPDATE "workspace_memberships" SET "operational_role" = 'workspace_user' WHERE "role" = 'member' AND "operational_role" IS NULL;

-- Domain engine tables
CREATE TABLE "domains" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "domain_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata_filters" JSONB NOT NULL DEFAULT '[]',
    "relationship_constraints" JSONB NOT NULL DEFAULT '{}',
    "source_package_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "domains_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domains_workspace_id_domain_key_key" ON "domains"("workspace_id", "domain_key");
CREATE INDEX "domains_workspace_id_idx" ON "domains"("workspace_id");

ALTER TABLE "domains" ADD CONSTRAINT "domains_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "domain_retrieval_rules" (
    "id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "domain_retrieval_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "domain_retrieval_rules_domain_id_idx" ON "domain_retrieval_rules"("domain_id");

ALTER TABLE "domain_retrieval_rules" ADD CONSTRAINT "domain_retrieval_rules_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "global_facts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "applies_to_metadata_keys" JSONB NOT NULL DEFAULT '[]',
    "source_package_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "global_facts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "global_facts_workspace_id_key_key" ON "global_facts"("workspace_id", "key");
CREATE INDEX "global_facts_workspace_id_idx" ON "global_facts"("workspace_id");

ALTER TABLE "global_facts" ADD CONSTRAINT "global_facts_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "domain_facts" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "applies_to_metadata_keys" JSONB NOT NULL DEFAULT '[]',
    "source_package_id" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "domain_facts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "domain_facts_domain_id_key_key" ON "domain_facts"("domain_id", "key");
CREATE INDEX "domain_facts_workspace_id_idx" ON "domain_facts"("workspace_id");

ALTER TABLE "domain_facts" ADD CONSTRAINT "domain_facts_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "domain_instructions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "domain_id" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "source_package_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "domain_instructions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "domain_instructions_domain_id_action_key_idx" ON "domain_instructions"("domain_id", "action_key");
CREATE INDEX "domain_instructions_workspace_id_idx" ON "domain_instructions"("workspace_id");

ALTER TABLE "domain_instructions" ADD CONSTRAINT "domain_instructions_domain_id_fkey" FOREIGN KEY ("domain_id") REFERENCES "domains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "package_definitions" (
    "id" TEXT NOT NULL,
    "package_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "manifest" JSONB NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "package_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "package_definitions_package_key_key" ON "package_definitions"("package_key");

CREATE TABLE "installed_packages" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "package_definition_id" TEXT NOT NULL,
    "package_key" TEXT NOT NULL,
    "installed_version" TEXT NOT NULL,
    "snapshot_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "manifest_snapshot" JSONB NOT NULL,
    "installed_by_user_id" TEXT,
    "installed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMP(3),
    CONSTRAINT "installed_packages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "installed_packages_workspace_id_idx" ON "installed_packages"("workspace_id");

ALTER TABLE "installed_packages" ADD CONSTRAINT "installed_packages_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "installed_packages" ADD CONSTRAINT "installed_packages_package_definition_id_fkey" FOREIGN KEY ("package_definition_id") REFERENCES "package_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
