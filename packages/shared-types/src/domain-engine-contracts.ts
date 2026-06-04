/**
 * Domain Engine + Package System contracts (Phase 1).
 * @see docs/domain-engine/CONTRACTS.md
 */

export type OperationalRole =
  | "middleware_admin"
  | "agency_admin"
  | "platform_admin"
  | "workspace_admin"
  | "workspace_user";

export type FactScope = "global" | "domain";

export type FactStatus = "active" | "archived";

export interface Fact {
  factId: string;
  workspaceId: string;
  scope: FactScope;
  domainId?: string;
  key: string;
  title: string;
  content: string;
  priority: number;
  status: FactStatus;
  appliesToMetadataKeys?: string[];
  sourcePackageId?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export type InstructionStatus = "active" | "archived";

export interface Instruction {
  instructionId: string;
  workspaceId: string;
  domainId: string;
  actionKey: string;
  title: string;
  content: string;
  status: InstructionStatus;
  version: number;
  isActive: boolean;
  sourcePackageId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface RetrievalRule {
  ruleId: string;
  domainId: string;
  name: string;
  memoryTypes?: string[];
  requiredMetadataKeys?: string[];
  metadataMatch?: Record<string, string | string[]>;
  rankingTagBoosts?: Record<string, number>;
  maxExpansionDepth?: number;
  tokenBudgetOverride?: number;
}

export interface RelationshipNeighborhoodConstraint {
  allowedTypes?: string[];
  maxDepth: number;
  targetMetadataKeys?: string[];
  maxNeighbors?: number;
}

export const DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT: RelationshipNeighborhoodConstraint = {
  maxDepth: 1,
};

export type DomainStatus = "active" | "archived";

export interface Domain {
  domainId: string;
  workspaceId: string;
  domainKey: string;
  name: string;
  description?: string;
  status: DomainStatus;
  retrievalRules: RetrievalRule[];
  metadataFilters: string[];
  relationshipConstraints: RelationshipNeighborhoodConstraint;
  sourcePackageId?: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface DomainExecutionContext {
  workspaceId: string;
  domainId?: string;
  domainKey?: string;
  domainAction?: string;
  globalFacts: Fact[];
  domainFacts: Fact[];
  instructions: Instruction[];
  retrievalRules: RetrievalRule[];
  metadataFilters: string[];
  relationshipConstraints: RelationshipNeighborhoodConstraint;
  resolvedAt: string;
}

export interface FactOverrideRecord {
  factId: string;
  factScope: FactScope;
  factKey: string;
  memoryId: string;
  chunkId: string;
  originalExcerpt: string;
  replacementText: string;
  precedenceRank: number;
  reason: string;
}

export type ManifestGlobalFact = Omit<
  Fact,
  "factId" | "workspaceId" | "domainId" | "version" | "createdAt" | "updatedAt"
>;

export type ManifestDomainFact = Omit<
  Fact,
  "factId" | "workspaceId" | "domainId" | "version" | "createdAt" | "updatedAt"
>;

export type ManifestInstruction = Omit<
  Instruction,
  | "instructionId"
  | "workspaceId"
  | "domainId"
  | "version"
  | "createdAt"
  | "updatedAt"
  | "isActive"
>;

export type ManifestRetrievalRule = Omit<RetrievalRule, "ruleId" | "domainId">;

export interface PackageManifestDomain {
  domainKey: string;
  name: string;
  description?: string;
  retrievalRules: ManifestRetrievalRule[];
  metadataFilters: string[];
  relationshipConstraints: RelationshipNeighborhoodConstraint;
  facts?: ManifestDomainFact[];
  instructions?: ManifestInstruction[];
}

export interface PackageManifest {
  packageKey: string;
  name: string;
  version: string;
  description?: string;
  domains: PackageManifestDomain[];
  globalFacts?: ManifestGlobalFact[];
  archiveRules?: Record<string, unknown>;
  metadataConfigs?: Record<string, unknown>;
}

export interface PackageManifestEntityDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface PackageManifestDomainDiff {
  domainKey: string;
  facts: PackageManifestEntityDiff;
  instructions: PackageManifestEntityDiff;
  metadataFiltersChanged: boolean;
  relationshipConstraintsChanged: boolean;
  retrievalRulesChanged: boolean;
}

export interface PackageManifestDiff {
  packageKey: string;
  versionChanged: { from: string; to: string } | null;
  globalFacts: PackageManifestEntityDiff;
  domains: {
    added: string[];
    removed: string[];
    changed: PackageManifestDomainDiff[];
  };
}

export interface PackageSnapshotRecord {
  snapshotVersion: string;
  manifest: PackageManifest;
  savedAt: string;
}

export type InstalledPackageStatus = "active" | "archived";

export interface InstalledPackage {
  installedPackageId: string;
  workspaceId: string;
  packageDefinitionId: string;
  packageKey: string;
  installedVersion: string;
  snapshotVersion: string;
  status: InstalledPackageStatus;
  installedAt: string;
  archivedAt?: string;
  installedByUserId?: string;
}

export interface PackageDefinitionRecord {
  packageDefinitionId: string;
  packageKey: string;
  name: string;
  version: string;
  description?: string;
  manifest: PackageManifest;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DomainContextMetadata {
  executionContext?: DomainExecutionContext;
  factOverrides: FactOverrideRecord[];
}

export const DOMAIN_ENGINE_EVENT_TYPES = {
  GLOBAL_FACT_CREATED: "global_fact_created",
  GLOBAL_FACT_UPDATED: "global_fact_updated",
  GLOBAL_FACT_ARCHIVED: "global_fact_archived",
  GLOBAL_FACT_DELETED: "global_fact_deleted",
  DOMAIN_CREATED: "domain_created",
  DOMAIN_UPDATED: "domain_updated",
  DOMAIN_ARCHIVED: "domain_archived",
  DOMAIN_DELETED: "domain_deleted",
  DOMAIN_FACT_CREATED: "domain_fact_created",
  DOMAIN_FACT_UPDATED: "domain_fact_updated",
  DOMAIN_FACT_ARCHIVED: "domain_fact_archived",
  DOMAIN_FACT_DELETED: "domain_fact_deleted",
  INSTRUCTION_CREATED: "instruction_created",
  INSTRUCTION_VERSIONED: "instruction_versioned",
  INSTRUCTION_ARCHIVED: "instruction_archived",
  PACKAGE_INSTALLED: "package_installed",
  PACKAGE_EXPORTED: "package_exported",
  PACKAGE_UPDATED: "package_updated",
  PACKAGE_ARCHIVED: "package_archived",
  EXECUTION_CONTEXT_RESOLVED: "execution_context_resolved",
  FACT_OVERRIDE_APPLIED: "fact_override_applied",
} as const;

export type DomainEngineEventType =
  (typeof DOMAIN_ENGINE_EVENT_TYPES)[keyof typeof DOMAIN_ENGINE_EVENT_TYPES];

/** Lowercase slug: domain keys, action keys, package keys, fact keys */
export const DOMAIN_SLUG_REGEX = /^[a-z][a-z0-9-]*$/;

export function isDomainSlug(value: string): boolean {
  return DOMAIN_SLUG_REGEX.test(value);
}
