import type {
  Domain,
  DomainStatus,
  Fact,
  FactScope,
  FactStatus,
  Instruction,
  InstructionStatus,
  InstalledPackage,
  InstalledPackageStatus,
  OperationalObject,
  OperationalObjectStatus,
  PackageDefinitionRecord,
  PackageManifest,
  RelationshipNeighborhoodConstraint,
  RetrievalRule,
} from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import type {
  Domain as PrismaDomain,
  DomainFact,
  DomainInstruction,
  DomainRetrievalRule,
  GlobalFact,
  InstalledPackage as PrismaInstalledPackage,
  OperationalObject as PrismaOperationalObject,
  PackageDefinition,
} from "@prisma/client";

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  return [];
}

export function parseRelationshipConstraints(
  value: unknown,
): RelationshipNeighborhoodConstraint {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return {
      maxDepth: typeof obj.maxDepth === "number" ? obj.maxDepth : 1,
      ...(Array.isArray(obj.allowedTypes)
        ? { allowedTypes: obj.allowedTypes.filter((t): t is string => typeof t === "string") }
        : {}),
      ...(Array.isArray(obj.targetMetadataKeys)
        ? {
            targetMetadataKeys: obj.targetMetadataKeys.filter(
              (t): t is string => typeof t === "string",
            ),
          }
        : {}),
      ...(typeof obj.maxNeighbors === "number" ? { maxNeighbors: obj.maxNeighbors } : {}),
    };
  }
  return DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT;
}

export function parseRetrievalRuleConfig(
  ruleId: string,
  domainId: string,
  name: string,
  config: unknown,
): RetrievalRule {
  const c = (config ?? {}) as Record<string, unknown>;
  const rule: RetrievalRule = { ruleId, domainId, name };
  if (Array.isArray(c.memoryTypes)) {
    rule.memoryTypes = c.memoryTypes.filter((t): t is string => typeof t === "string");
  }
  if (Array.isArray(c.requiredMetadataKeys)) {
    rule.requiredMetadataKeys = c.requiredMetadataKeys.filter(
      (t): t is string => typeof t === "string",
    );
  }
  if (c.metadataMatch && typeof c.metadataMatch === "object" && !Array.isArray(c.metadataMatch)) {
    rule.metadataMatch = c.metadataMatch as Record<string, string | string[]>;
  }
  if (c.rankingTagBoosts && typeof c.rankingTagBoosts === "object") {
    rule.rankingTagBoosts = c.rankingTagBoosts as Record<string, number>;
  }
  if (typeof c.maxExpansionDepth === "number") rule.maxExpansionDepth = c.maxExpansionDepth;
  if (typeof c.tokenBudgetOverride === "number") rule.tokenBudgetOverride = c.tokenBudgetOverride;
  if (Array.isArray(c.objectTypeFilter)) {
    rule.objectTypeFilter = c.objectTypeFilter.filter((t): t is string => typeof t === "string");
  }
  if (
    c.objectMetadataMatch &&
    typeof c.objectMetadataMatch === "object" &&
    !Array.isArray(c.objectMetadataMatch)
  ) {
    rule.objectMetadataMatch = c.objectMetadataMatch as Record<string, string | string[]>;
  }
  return rule;
}

export function retrievalRuleToConfig(
  rule: Omit<RetrievalRule, "ruleId" | "domainId">,
): Record<string, unknown> {
  const config: Record<string, unknown> = {};
  if (rule.memoryTypes) config.memoryTypes = rule.memoryTypes;
  if (rule.requiredMetadataKeys) config.requiredMetadataKeys = rule.requiredMetadataKeys;
  if (rule.metadataMatch) config.metadataMatch = rule.metadataMatch;
  if (rule.rankingTagBoosts) config.rankingTagBoosts = rule.rankingTagBoosts;
  if (rule.maxExpansionDepth != null) config.maxExpansionDepth = rule.maxExpansionDepth;
  if (rule.tokenBudgetOverride != null) config.tokenBudgetOverride = rule.tokenBudgetOverride;
  if (rule.objectTypeFilter) config.objectTypeFilter = rule.objectTypeFilter;
  if (rule.objectMetadataMatch) config.objectMetadataMatch = rule.objectMetadataMatch;
  return config;
}

export function mapGlobalFact(row: GlobalFact): Fact {
  const fact: Fact = {
    factId: row.id,
    workspaceId: row.workspaceId,
    scope: "global",
    key: row.key,
    title: row.title,
    content: row.content,
    priority: row.priority,
    status: row.status as FactStatus,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  const keys = parseJsonArray(row.appliesToMetadataKeys);
  if (keys.length) fact.appliesToMetadataKeys = keys;
  if (row.sourcePackageId) fact.sourcePackageId = row.sourcePackageId;
  if (row.archivedAt) fact.archivedAt = row.archivedAt.toISOString();
  return fact;
}

export function mapDomainFact(row: DomainFact): Fact {
  const fact: Fact = {
    factId: row.id,
    workspaceId: row.workspaceId,
    scope: "domain",
    domainId: row.domainId,
    key: row.key,
    title: row.title,
    content: row.content,
    priority: row.priority,
    status: row.status as FactStatus,
    version: row.version,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  const keys = parseJsonArray(row.appliesToMetadataKeys);
  if (keys.length) fact.appliesToMetadataKeys = keys;
  if (row.sourcePackageId) fact.sourcePackageId = row.sourcePackageId;
  if (row.archivedAt) fact.archivedAt = row.archivedAt.toISOString();
  return fact;
}

export function mapInstruction(row: DomainInstruction): Instruction {
  const instruction: Instruction = {
    instructionId: row.id,
    workspaceId: row.workspaceId,
    domainId: row.domainId,
    actionKey: row.actionKey,
    title: row.title,
    content: row.content,
    status: row.status as InstructionStatus,
    version: row.version,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.sourcePackageId) instruction.sourcePackageId = row.sourcePackageId;
  if (row.archivedAt) instruction.archivedAt = row.archivedAt.toISOString();
  return instruction;
}

export function mapDomain(
  row: PrismaDomain,
  rules: DomainRetrievalRule[],
): Domain {
  const domain: Domain = {
    domainId: row.id,
    workspaceId: row.workspaceId,
    domainKey: row.domainKey,
    name: row.name,
    status: row.status as DomainStatus,
    retrievalRules: rules.map((r) =>
      parseRetrievalRuleConfig(r.id, r.domainId, r.name, r.config),
    ),
    metadataFilters: parseJsonArray(row.metadataFilters),
    relationshipConstraints: parseRelationshipConstraints(row.relationshipConstraints),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.description) domain.description = row.description;
  if (row.sourcePackageId) domain.sourcePackageId = row.sourcePackageId;
  if (row.archivedAt) domain.archivedAt = row.archivedAt.toISOString();
  return domain;
}

export function mapInstalledPackage(row: PrismaInstalledPackage): InstalledPackage {
  const pkg: InstalledPackage = {
    installedPackageId: row.id,
    workspaceId: row.workspaceId,
    packageDefinitionId: row.packageDefinitionId,
    packageKey: row.packageKey,
    installedVersion: row.installedVersion,
    snapshotVersion: row.snapshotVersion,
    status: row.status as InstalledPackageStatus,
    installedAt: row.installedAt.toISOString(),
  };
  if (row.archivedAt) pkg.archivedAt = row.archivedAt.toISOString();
  if (row.installedByUserId) pkg.installedByUserId = row.installedByUserId;
  return pkg;
}

export function mapPackageDefinition(row: PackageDefinition): PackageDefinitionRecord {
  const record: PackageDefinitionRecord = {
    packageDefinitionId: row.id,
    packageKey: row.packageKey,
    name: row.name,
    version: row.version,
    manifest: row.manifest as unknown as PackageManifest,
    published: row.published,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.description) record.description = row.description;
  return record;
}

export function parseOperationalObjectMetadata(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function mapOperationalObject(row: PrismaOperationalObject): OperationalObject {
  const object: OperationalObject = {
    objectId: row.id,
    workspaceId: row.workspaceId,
    objectType: row.objectType,
    name: row.name,
    status: row.status,
    metadata: parseOperationalObjectMetadata(row.metadata),
    objectStatus: row.rowStatus as OperationalObjectStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
  if (row.archivedAt) object.archivedAt = row.archivedAt.toISOString();
  return object;
}

export function matchesOperationalObjectMetadata(
  metadata: Record<string, unknown>,
  match: Record<string, string | string[]>,
): boolean {
  for (const [key, expected] of Object.entries(match)) {
    const actual = metadata[key];
    if (Array.isArray(expected)) {
      if (!expected.includes(String(actual ?? ""))) return false;
    } else if (String(actual ?? "") !== expected) {
      return false;
    }
  }
  return true;
}
