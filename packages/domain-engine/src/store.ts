import type {
  Domain,
  Fact,
  Instruction,
  InstalledPackage,
  PackageDefinitionRecord,
  PackageManifest,
  RelationshipNeighborhoodConstraint,
  RetrievalRule,
  OperationalObject,
  ListOperationalObjectsResult,
} from "@memory-middleware/shared-types";

export interface CreateGlobalFactInput {
  workspaceId: string;
  key: string;
  title: string;
  content: string;
  priority?: number;
  appliesToMetadataKeys?: string[];
  sourcePackageId?: string;
}

export interface UpdateGlobalFactInput {
  title?: string;
  content?: string;
  priority?: number;
  appliesToMetadataKeys?: string[];
}

export interface CreateDomainInput {
  workspaceId: string;
  domainKey: string;
  name: string;
  description?: string;
  metadataFilters?: string[];
  relationshipConstraints?: RelationshipNeighborhoodConstraint;
  retrievalRules?: Omit<RetrievalRule, "ruleId" | "domainId">[];
  sourcePackageId?: string;
}

export interface UpdateDomainInput {
  name?: string;
  description?: string;
  metadataFilters?: string[];
  relationshipConstraints?: RelationshipNeighborhoodConstraint;
  retrievalRules?: Omit<RetrievalRule, "ruleId" | "domainId">[];
}

export interface CreateDomainFactInput {
  workspaceId: string;
  domainId: string;
  key: string;
  title: string;
  content: string;
  priority?: number;
  appliesToMetadataKeys?: string[];
  sourcePackageId?: string;
}

export interface UpdateDomainFactInput {
  title?: string;
  content?: string;
  priority?: number;
  appliesToMetadataKeys?: string[];
}

export interface CreateInstructionInput {
  workspaceId: string;
  domainId: string;
  actionKey: string;
  title: string;
  content: string;
  sourcePackageId?: string;
}

export interface VersionInstructionInput {
  title?: string;
  content: string;
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

export interface InstallPackageInput {
  workspaceId: string;
  manifest?: PackageManifest;
  packageDefinitionId?: string;
  installedByUserId?: string;
  failOnConflict?: boolean;
}

export interface ExecutionContextLoadResult {
  domain: Domain | null;
  globalFacts: Fact[];
  domainFacts: Fact[];
  instructions: Instruction[];
}

/** Persistence port — implemented by API Prisma layer. */
export interface DomainEngineStore {
  createGlobalFact(input: CreateGlobalFactInput): Promise<Fact>;
  updateGlobalFact(factId: string, input: UpdateGlobalFactInput): Promise<Fact | null>;
  archiveGlobalFact(factId: string): Promise<Fact | null>;
  deleteGlobalFact(factId: string): Promise<boolean>;
  getGlobalFact(factId: string): Promise<Fact | null>;
  listActiveGlobalFacts(workspaceId: string): Promise<Fact[]>;

  createDomain(input: CreateDomainInput): Promise<Domain>;
  updateDomain(domainId: string, input: UpdateDomainInput): Promise<Domain | null>;
  archiveDomain(domainId: string): Promise<Domain | null>;
  deleteDomain(domainId: string): Promise<boolean>;
  getDomainById(domainId: string): Promise<Domain | null>;
  getDomainByKey(workspaceId: string, domainKey: string): Promise<Domain | null>;
  listDomains(workspaceId: string, includeArchived?: boolean): Promise<Domain[]>;

  createDomainFact(input: CreateDomainFactInput): Promise<Fact>;
  updateDomainFact(factId: string, input: UpdateDomainFactInput): Promise<Fact | null>;
  archiveDomainFact(factId: string): Promise<Fact | null>;
  deleteDomainFact(factId: string): Promise<boolean>;
  getDomainFact(factId: string): Promise<Fact | null>;
  listActiveDomainFacts(domainId: string): Promise<Fact[]>;

  createInstruction(input: CreateInstructionInput): Promise<Instruction>;
  versionInstruction(
    domainId: string,
    actionKey: string,
    input: VersionInstructionInput,
  ): Promise<Instruction>;
  archiveInstruction(instructionId: string): Promise<Instruction | null>;
  getInstruction(instructionId: string): Promise<Instruction | null>;
  getActiveInstruction(domainId: string, actionKey: string): Promise<Instruction | null>;
  listInstructions(domainId: string, actionKey?: string): Promise<Instruction[]>;

  getPackageDefinition(packageDefinitionId: string): Promise<PackageDefinitionRecord | null>;
  getPackageDefinitionByKey(packageKey: string): Promise<PackageDefinitionRecord | null>;
  listPackageDefinitions(publishedOnly?: boolean): Promise<PackageDefinitionRecord[]>;
  upsertPackageDefinition(manifest: PackageManifest, published?: boolean): Promise<PackageDefinitionRecord>;
  installPackage(input: InstallPackageInput): Promise<InstalledPackage>;
  getInstalledPackage(installedPackageId: string): Promise<InstalledPackage | null>;
  exportInstalledPackage(installedPackageId: string): Promise<PackageManifest | null>;
  cloneInstalledPackage(
    sourceInstalledPackageId: string,
    targetWorkspaceId: string,
    installedByUserId?: string,
  ): Promise<InstalledPackage>;
  updateInstalledPackageFromManifest(
    installedPackageId: string,
    manifest: PackageManifest,
    failOnConflict?: boolean,
  ): Promise<InstalledPackage>;
  archiveInstalledPackage(installedPackageId: string): Promise<InstalledPackage | null>;
  rollbackInstalledPackage(
    installedPackageId: string,
    snapshotVersion: string,
  ): Promise<InstalledPackage>;
  listInstalledPackages(workspaceId: string, includeArchived?: boolean): Promise<InstalledPackage[]>;

  loadExecutionContextData(
    workspaceId: string,
    domainKey?: string,
    domainAction?: string,
  ): Promise<ExecutionContextLoadResult>;

  createOperationalObject(input: CreateOperationalObjectInput): Promise<OperationalObject>;
  updateOperationalObject(
    objectId: string,
    input: UpdateOperationalObjectInput,
  ): Promise<OperationalObject | null>;
  archiveOperationalObject(objectId: string): Promise<OperationalObject | null>;
  deleteOperationalObject(objectId: string): Promise<boolean>;
  getOperationalObject(objectId: string): Promise<OperationalObject | null>;
  listOperationalObjects(query: ListOperationalObjectsQuery): Promise<ListOperationalObjectsResult>;
}
