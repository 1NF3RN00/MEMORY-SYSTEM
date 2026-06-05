/**
 * Domain Engine + Package System contracts (Phase 1).
 * @see docs/domain-engine/CONTRACTS.md
 */

import type { NormalizedObservation, ObservationFilter } from "./observation-contracts.js";

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
  /** When set, include operational objects of these types in domain scope */
  objectTypeFilter?: string[];
  objectMetadataMatch?: Record<string, string | string[]>;
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
  observationFilters: ObservationFilter[];
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
  observationFilters: ObservationFilter[];
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
  observationFilters?: ObservationFilter[];
  relationshipConstraints: RelationshipNeighborhoodConstraint;
  facts?: ManifestDomainFact[];
  instructions?: ManifestInstruction[];
}

export interface PackageWorkflowRef {
  workflowKey: string;
  name: string;
  description?: string;
  domains: string[];
  outputTypes: string[];
  analysisSpecKey: string;
}

export interface PackageManifest {
  packageKey: string;
  name: string;
  version: string;
  description?: string;
  domains: PackageManifestDomain[];
  globalFacts?: ManifestGlobalFact[];
  workflows?: PackageWorkflowRef[];
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
  workflows: PackageManifestEntityDiff;
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

export type OperationalObjectStatus = "active" | "archived";

export interface OperationalObject {
  objectId: string;
  workspaceId: string;
  objectType: string;
  name: string;
  status: string;
  metadata: Record<string, unknown>;
  objectStatus: OperationalObjectStatus;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateOperationalObjectInput {
  workspaceId: string;
  objectType: string;
  name: string;
  status: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateOperationalObjectInput {
  name?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export interface ListOperationalObjectsQuery {
  workspaceId: string;
  objectType?: string;
  status?: string;
  metadataMatch?: Record<string, string | string[]>;
  includeArchived?: boolean;
  limit?: number;
  cursor?: string;
}

export interface ListOperationalObjectsResult {
  objects: OperationalObject[];
  nextCursor?: string;
}

export interface WorkflowInstructionRef {
  domainKey: string;
  actionKey: string;
}

export interface Workflow {
  workflowId: string;
  workspaceId: string;
  workflowKey?: string;
  name: string;
  description: string;
  domains: string[];
  packages: string[];
  instructionRefs: WorkflowInstructionRef[];
  outputTypes: string[];
  objectTypeFilters?: string[];
  analysisSpecKey?: string;
  sourcePackageId?: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export interface CreateWorkflowInput {
  workspaceId: string;
  workflowKey?: string;
  name: string;
  description?: string;
  domains?: string[];
  packages?: string[];
  instructionRefs?: WorkflowInstructionRef[];
  outputTypes?: string[];
  objectTypeFilters?: string[];
  analysisSpecKey?: string;
}

export interface UpdateWorkflowInput {
  workflowKey?: string;
  name?: string;
  description?: string;
  domains?: string[];
  packages?: string[];
  instructionRefs?: WorkflowInstructionRef[];
  outputTypes?: string[];
  objectTypeFilters?: string[];
  analysisSpecKey?: string;
  active?: boolean;
}

export interface WorkflowRun {
  workflowRunId: string;
  workflowId: string;
  workspaceId: string;
  status: "pending" | "running" | "completed" | "failed" | "archived";
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
  outputCount: number;
  generatedFactIds: string[];
  generatedMemoryIds: string[];
  generatedObjectIds: string[];
  archivedAt?: string;
}

export interface WorkflowOutput {
  outputId: string;
  workflowRunId: string;
  workspaceId: string;
  outputType: string;
  title: string;
  content: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowRunDetail extends WorkflowRun {
  outputs: WorkflowOutput[];
  generatedFacts: Fact[];
  generatedObjects: OperationalObject[];
  executionContext: WorkflowExecutionContext;
}

export interface WorkflowExecutionContext {
  workflowId: string;
  workflowRunId?: string;
  workspaceId: string;
  domains: Domain[];
  packages: InstalledPackage[];
  globalFacts: Fact[];
  domainFacts: Fact[];
  instructions: Instruction[];
  objects: OperationalObject[];
  observations: NormalizedObservation[];
  retrievedContext: import("./retrieval-contracts.js").ContextPackage[];
  previousWorkflowRuns: WorkflowRunDetail[];
  resolvedAt: string;
}

export type WorkflowContextLayer =
  | "globalFacts"
  | "domainFacts"
  | "instructions"
  | "objects"
  | "observations"
  | "retrievedContext"
  | "previousWorkflowRuns";

export const WORKFLOW_CONTEXT_LAYER_ORDER: readonly WorkflowContextLayer[] = [
  "globalFacts",
  "domainFacts",
  "instructions",
  "objects",
  "observations",
  "retrievedContext",
  "previousWorkflowRuns",
] as const;

export const DEFAULT_WORKFLOW_PREVIOUS_RUN_LIMIT = 10;

export interface ExecuteWorkflowInput {
  workspaceId: string;
  workflowId: string;
  query: string;
  tokenBudget?: number;
  previousRunLimit?: number;
}

export interface WorkflowReplayPayload {
  workflowId: string;
  workflowRunId: string;
  workspaceId: string;
  executionContext: WorkflowExecutionContext;
  outputs: WorkflowOutput[];
  generatedFactIds: string[];
  generatedMemoryIds: string[];
  generatedObjectIds: string[];
  domainKey?: string;
  domainAction?: string;
}

export interface CreateWorkflowRunInput {
  workflowId: string;
  workspaceId: string;
  status?: WorkflowRun["status"];
}

export interface UpdateWorkflowRunInput {
  status?: WorkflowRun["status"];
  completedAt?: string;
  errorMessage?: string;
  outputCount?: number;
  generatedFactIds?: string[];
  generatedMemoryIds?: string[];
  generatedObjectIds?: string[];
  executionContext?: WorkflowExecutionContext;
}

export interface CreateWorkflowOutputInput {
  workflowRunId: string;
  workspaceId: string;
  outputType: string;
  title: string;
  content: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
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

export const OPERATIONAL_OBJECT_EVENT_TYPES = {
  OPERATIONAL_OBJECT_CREATED: "operational_object_created",
  OPERATIONAL_OBJECT_UPDATED: "operational_object_updated",
  OPERATIONAL_OBJECT_ARCHIVED: "operational_object_archived",
  OPERATIONAL_OBJECT_DELETED: "operational_object_deleted",
} as const;

export type OperationalObjectEventType =
  (typeof OPERATIONAL_OBJECT_EVENT_TYPES)[keyof typeof OPERATIONAL_OBJECT_EVENT_TYPES];

export const WORKFLOW_ENGINE_EVENT_TYPES = {
  WORKFLOW_CREATED: "workflow_created",
  WORKFLOW_UPDATED: "workflow_updated",
  WORKFLOW_ARCHIVED: "workflow_archived",
  WORKFLOW_STARTED: "workflow_started",
  WORKFLOW_CONTEXT_BUILT: "workflow_context_built",
  WORKFLOW_RETRIEVAL_COMPLETED: "workflow_retrieval_completed",
  WORKFLOW_EXECUTION_COMPLETED: "workflow_execution_completed",
  WORKFLOW_FAILED: "workflow_failed",
  WORKFLOW_OUTPUT_GENERATED: "workflow_output_generated",
  WORKFLOW_RUN_ARCHIVED: "workflow_run_archived",
} as const;

export type WorkflowEngineEventType =
  (typeof WORKFLOW_ENGINE_EVENT_TYPES)[keyof typeof WORKFLOW_ENGINE_EVENT_TYPES];

export type DomainEngineEventType =
  (typeof DOMAIN_ENGINE_EVENT_TYPES)[keyof typeof DOMAIN_ENGINE_EVENT_TYPES];

/** Lowercase slug: domain keys, action keys, package keys, fact keys */
export const DOMAIN_SLUG_REGEX = /^[a-z][a-z0-9-]*$/;

export function isDomainSlug(value: string): boolean {
  return DOMAIN_SLUG_REGEX.test(value);
}
