import type { DomainEngineStore, InstallPackageInput } from "@memory-middleware/domain-engine";
import type {
  CreateDomainFactInput,
  CreateDomainInput,
  CreateGlobalFactInput,
  CreateInstructionInput,
  CreateOperationalObjectInput,
  UpdateDomainFactInput,
  UpdateDomainInput,
  UpdateGlobalFactInput,
  UpdateOperationalObjectInput,
  VersionInstructionInput,
  ListOperationalObjectsQuery,
} from "@memory-middleware/domain-engine";
import { DomainEngineError } from "@memory-middleware/domain-engine";
import type {
  InstalledPackage,
  PackageManifest,
  PackageSnapshotRecord,
} from "@memory-middleware/shared-types";
import {
  DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
  newUlid,
} from "@memory-middleware/shared-types";
import {
  applyManifestToWorkspace,
  buildManifestFromInstalledPackage,
  parseSnapshotHistory,
  resolveManifestForInstall,
} from "./package-operations.js";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  mapDomain,
  mapDomainFact,
  mapGlobalFact,
  mapInstalledPackage,
  mapInstruction,
  mapOperationalObject,
  mapPackageDefinition,
  matchesOperationalObjectMetadata,
  retrievalRuleToConfig,
} from "./mappers.js";

async function loadDomainWithRules(
  prisma: PrismaClient,
  row: { id: string } | null,
): Promise<ReturnType<typeof mapDomain> | null> {
  if (!row) return null;
  const full = await prisma.domain.findUnique({
    where: { id: row.id },
    include: { retrievalRules: { orderBy: { sortOrder: "asc" } } },
  });
  if (!full) return null;
  return mapDomain(full, full.retrievalRules);
}

export function createPrismaDomainEngineStore(prisma: PrismaClient): DomainEngineStore {
  return {
    async createGlobalFact(input: CreateGlobalFactInput) {
      const row = await prisma.globalFact.create({
        data: {
          id: newUlid(),
          workspaceId: input.workspaceId,
          key: input.key,
          title: input.title,
          content: input.content,
          priority: input.priority ?? 0,
          appliesToMetadataKeys: (input.appliesToMetadataKeys ?? []) as Prisma.InputJsonValue,
          ...(input.sourcePackageId ? { sourcePackageId: input.sourcePackageId } : {}),
        },
      });
      return mapGlobalFact(row);
    },

    async updateGlobalFact(factId, input) {
      const row = await prisma.globalFact.update({
        where: { id: factId },
        data: {
          ...(input.title != null ? { title: input.title } : {}),
          ...(input.content != null ? { content: input.content } : {}),
          ...(input.priority != null ? { priority: input.priority } : {}),
          ...(input.appliesToMetadataKeys != null
            ? { appliesToMetadataKeys: input.appliesToMetadataKeys as Prisma.InputJsonValue }
            : {}),
          version: { increment: 1 },
        },
      });
      return mapGlobalFact(row);
    },

    async archiveGlobalFact(factId) {
      const row = await prisma.globalFact.update({
        where: { id: factId },
        data: { status: "archived", archivedAt: new Date() },
      });
      return mapGlobalFact(row);
    },

    async deleteGlobalFact(factId) {
      await prisma.globalFact.delete({ where: { id: factId } });
      return true;
    },

    async getGlobalFact(factId) {
      const row = await prisma.globalFact.findUnique({ where: { id: factId } });
      return row ? mapGlobalFact(row) : null;
    },

    async listActiveGlobalFacts(workspaceId) {
      const rows = await prisma.globalFact.findMany({
        where: { workspaceId, status: "active" },
        orderBy: [{ priority: "desc" }, { key: "asc" }],
      });
      return rows.map(mapGlobalFact);
    },

    async createDomain(input: CreateDomainInput) {
      const domainId = newUlid();
      const constraints = input.relationshipConstraints ?? DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT;
      await prisma.domain.create({
        data: {
          id: domainId,
          workspaceId: input.workspaceId,
          domainKey: input.domainKey,
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          metadataFilters: (input.metadataFilters ?? []) as Prisma.InputJsonValue,
          relationshipConstraints: constraints as unknown as Prisma.InputJsonValue,
          ...(input.sourcePackageId ? { sourcePackageId: input.sourcePackageId } : {}),
          retrievalRules: {
            create: (input.retrievalRules ?? []).map((rule, index) => ({
              id: newUlid(),
              name: rule.name,
              config: retrievalRuleToConfig(rule) as Prisma.InputJsonValue,
              sortOrder: index,
            })),
          },
        },
      });
      return (await loadDomainWithRules(prisma, { id: domainId }))!;
    },

    async updateDomain(domainId, input) {
      const existing = await prisma.domain.findUnique({ where: { id: domainId } });
      if (!existing) return null;

      await prisma.$transaction(async (tx) => {
        await tx.domain.update({
          where: { id: domainId },
          data: {
            ...(input.name != null ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
            ...(input.metadataFilters != null
              ? { metadataFilters: input.metadataFilters as Prisma.InputJsonValue }
              : {}),
            ...(input.relationshipConstraints != null
              ? {
                  relationshipConstraints:
                    input.relationshipConstraints as unknown as Prisma.InputJsonValue,
                }
              : {}),
          },
        });
        if (input.retrievalRules != null) {
          await tx.domainRetrievalRule.deleteMany({ where: { domainId } });
          if (input.retrievalRules.length > 0) {
            await tx.domainRetrievalRule.createMany({
              data: input.retrievalRules.map((rule, index) => ({
                id: newUlid(),
                domainId,
                name: rule.name,
                config: retrievalRuleToConfig(rule) as Prisma.InputJsonValue,
                sortOrder: index,
              })),
            });
          }
        }
      });

      return loadDomainWithRules(prisma, { id: domainId });
    },

    async archiveDomain(domainId) {
      const row = await prisma.domain.update({
        where: { id: domainId },
        data: { status: "archived", archivedAt: new Date() },
      });
      return loadDomainWithRules(prisma, row);
    },

    async deleteDomain(domainId) {
      await prisma.domain.delete({ where: { id: domainId } });
      return true;
    },

    async getDomainById(domainId) {
      return loadDomainWithRules(prisma, { id: domainId });
    },

    async getDomainByKey(workspaceId, domainKey) {
      const row = await prisma.domain.findUnique({
        where: { workspaceId_domainKey: { workspaceId, domainKey } },
      });
      return loadDomainWithRules(prisma, row);
    },

    async listDomains(workspaceId, includeArchived = false) {
      const rows = await prisma.domain.findMany({
        where: {
          workspaceId,
          ...(includeArchived ? {} : { status: "active" }),
        },
        include: { retrievalRules: { orderBy: { sortOrder: "asc" } } },
        orderBy: { domainKey: "asc" },
      });
      return rows.map((r) => mapDomain(r, r.retrievalRules));
    },

    async createDomainFact(input: CreateDomainFactInput) {
      const row = await prisma.domainFact.create({
        data: {
          id: newUlid(),
          workspaceId: input.workspaceId,
          domainId: input.domainId,
          key: input.key,
          title: input.title,
          content: input.content,
          priority: input.priority ?? 0,
          appliesToMetadataKeys: (input.appliesToMetadataKeys ?? []) as Prisma.InputJsonValue,
          ...(input.sourcePackageId ? { sourcePackageId: input.sourcePackageId } : {}),
        },
      });
      return mapDomainFact(row);
    },

    async updateDomainFact(factId, input) {
      const row = await prisma.domainFact.update({
        where: { id: factId },
        data: {
          ...(input.title != null ? { title: input.title } : {}),
          ...(input.content != null ? { content: input.content } : {}),
          ...(input.priority != null ? { priority: input.priority } : {}),
          ...(input.appliesToMetadataKeys != null
            ? { appliesToMetadataKeys: input.appliesToMetadataKeys as Prisma.InputJsonValue }
            : {}),
          version: { increment: 1 },
        },
      });
      return mapDomainFact(row);
    },

    async archiveDomainFact(factId) {
      const row = await prisma.domainFact.update({
        where: { id: factId },
        data: { status: "archived", archivedAt: new Date() },
      });
      return mapDomainFact(row);
    },

    async deleteDomainFact(factId) {
      await prisma.domainFact.delete({ where: { id: factId } });
      return true;
    },

    async getDomainFact(factId) {
      const row = await prisma.domainFact.findUnique({ where: { id: factId } });
      return row ? mapDomainFact(row) : null;
    },

    async listActiveDomainFacts(domainId) {
      const rows = await prisma.domainFact.findMany({
        where: { domainId, status: "active" },
        orderBy: [{ priority: "desc" }, { key: "asc" }],
      });
      return rows.map(mapDomainFact);
    },

    async createInstruction(input: CreateInstructionInput) {
      const row = await prisma.domainInstruction.create({
        data: {
          id: newUlid(),
          workspaceId: input.workspaceId,
          domainId: input.domainId,
          actionKey: input.actionKey,
          title: input.title,
          content: input.content,
          ...(input.sourcePackageId ? { sourcePackageId: input.sourcePackageId } : {}),
        },
      });
      return mapInstruction(row);
    },

    async versionInstruction(domainId, actionKey, input) {
      await prisma.domainInstruction.updateMany({
        where: { domainId, actionKey, isActive: true },
        data: { isActive: false },
      });
      const latest = await prisma.domainInstruction.findFirst({
        where: { domainId, actionKey },
        orderBy: { version: "desc" },
      });
      const row = await prisma.domainInstruction.create({
        data: {
          id: newUlid(),
          workspaceId: latest?.workspaceId ?? (await prisma.domain.findUniqueOrThrow({ where: { id: domainId } })).workspaceId,
          domainId,
          actionKey,
          title: input.title ?? latest?.title ?? actionKey,
          content: input.content,
          version: (latest?.version ?? 0) + 1,
          isActive: true,
          ...(latest?.sourcePackageId ? { sourcePackageId: latest.sourcePackageId } : {}),
        },
      });
      return mapInstruction(row);
    },

    async archiveInstruction(instructionId) {
      const row = await prisma.domainInstruction.update({
        where: { id: instructionId },
        data: { status: "archived", isActive: false, archivedAt: new Date() },
      });
      return mapInstruction(row);
    },

    async getInstruction(instructionId) {
      const row = await prisma.domainInstruction.findUnique({ where: { id: instructionId } });
      return row ? mapInstruction(row) : null;
    },

    async getActiveInstruction(domainId, actionKey) {
      const row = await prisma.domainInstruction.findFirst({
        where: { domainId, actionKey, isActive: true, status: "active" },
        orderBy: { version: "desc" },
      });
      return row ? mapInstruction(row) : null;
    },

    async listInstructions(domainId, actionKey) {
      const rows = await prisma.domainInstruction.findMany({
        where: { domainId, ...(actionKey ? { actionKey } : {}) },
        orderBy: [{ actionKey: "asc" }, { version: "desc" }],
      });
      return rows.map(mapInstruction);
    },

    async getPackageDefinition(packageDefinitionId) {
      const row = await prisma.packageDefinition.findUnique({ where: { id: packageDefinitionId } });
      return row ? mapPackageDefinition(row) : null;
    },

    async getPackageDefinitionByKey(packageKey) {
      const row = await prisma.packageDefinition.findUnique({ where: { packageKey } });
      return row ? mapPackageDefinition(row) : null;
    },

    async listPackageDefinitions(publishedOnly = false) {
      const rows = await prisma.packageDefinition.findMany({
        ...(publishedOnly ? { where: { published: true } } : {}),
        orderBy: { packageKey: "asc" },
      });
      return rows.map(mapPackageDefinition);
    },

    async upsertPackageDefinition(manifest, published = false) {
      const row = await prisma.packageDefinition.upsert({
        where: { packageKey: manifest.packageKey },
        create: {
          id: newUlid(),
          packageKey: manifest.packageKey,
          name: manifest.name,
          version: manifest.version,
          ...(manifest.description ? { description: manifest.description } : {}),
          manifest: manifest as unknown as Prisma.InputJsonValue,
          published,
        },
        update: {
          name: manifest.name,
          version: manifest.version,
          ...(manifest.description !== undefined ? { description: manifest.description } : {}),
          manifest: manifest as unknown as Prisma.InputJsonValue,
          published,
        },
      });
      return mapPackageDefinition(row);
    },

    async installPackage(input: InstallPackageInput) {
      return installPackageTransaction(prisma, input);
    },

    async getInstalledPackage(installedPackageId) {
      const row = await prisma.installedPackage.findUnique({ where: { id: installedPackageId } });
      return row ? mapInstalledPackage(row) : null;
    },

    async exportInstalledPackage(installedPackageId) {
      const row = await prisma.installedPackage.findUnique({ where: { id: installedPackageId } });
      if (!row) return null;
      return buildManifestFromInstalledPackage(prisma, installedPackageId, row.workspaceId);
    },

    async cloneInstalledPackage(sourceInstalledPackageId, targetWorkspaceId, installedByUserId) {
      const source = await prisma.installedPackage.findUnique({
        where: { id: sourceInstalledPackageId },
      });
      if (!source) {
        throw new DomainEngineError("Source installed package not found", "not_found");
      }
      const manifest = source.manifestSnapshot as unknown as PackageManifest;
      return installPackageTransaction(prisma, {
        workspaceId: targetWorkspaceId,
        manifest,
        packageDefinitionId: source.packageDefinitionId,
        ...(installedByUserId ? { installedByUserId } : {}),
        failOnConflict: false,
      });
    },

    async updateInstalledPackageFromManifest(installedPackageId, manifest, failOnConflict = true) {
      const existing = await prisma.installedPackage.findUnique({ where: { id: installedPackageId } });
      if (!existing) {
        throw new DomainEngineError("Installed package not found", "not_found");
      }

      const history = parseSnapshotHistory(existing.snapshotHistory);
      const priorSnapshot: PackageSnapshotRecord = {
        snapshotVersion: existing.snapshotVersion,
        manifest: existing.manifestSnapshot as unknown as PackageManifest,
        savedAt: new Date().toISOString(),
      };
      history.push(priorSnapshot);

      const snapshotVersion = new Date().toISOString();

      await prisma.$transaction(async (tx) => {
        await applyManifestToWorkspace(tx, {
          workspaceId: existing.workspaceId,
          manifest,
          sourcePackageId: installedPackageId,
          failOnConflict,
        });
        await tx.installedPackage.update({
          where: { id: installedPackageId },
          data: {
            installedVersion: manifest.version,
            snapshotVersion,
            manifestSnapshot: manifest as unknown as Prisma.InputJsonValue,
            snapshotHistory: history as unknown as Prisma.InputJsonValue,
          },
        });
      });

      const updated = await prisma.installedPackage.findUnique({ where: { id: installedPackageId } });
      if (!updated) {
        throw new DomainEngineError("Installed package not found", "not_found");
      }
      return mapInstalledPackage(updated);
    },

    async rollbackInstalledPackage(installedPackageId, snapshotVersion) {
      const existing = await prisma.installedPackage.findUnique({ where: { id: installedPackageId } });
      if (!existing) {
        throw new DomainEngineError("Installed package not found", "not_found");
      }

      let manifest: PackageManifest;
      if (existing.snapshotVersion === snapshotVersion) {
        manifest = existing.manifestSnapshot as unknown as PackageManifest;
      } else {
        const history = parseSnapshotHistory(existing.snapshotHistory);
        const entry = history.find((h) => h.snapshotVersion === snapshotVersion);
        if (!entry) {
          throw new DomainEngineError(
            `Snapshot version not found: ${snapshotVersion}`,
            "not_found",
            { availableSnapshots: [existing.snapshotVersion, ...history.map((h) => h.snapshotVersion)] },
          );
        }
        manifest = entry.manifest;
      }

      await prisma.$transaction(async (tx) => {
        await applyManifestToWorkspace(tx, {
          workspaceId: existing.workspaceId,
          manifest,
          sourcePackageId: installedPackageId,
          failOnConflict: false,
        });
        await tx.installedPackage.update({
          where: { id: installedPackageId },
          data: {
            installedVersion: manifest.version,
            snapshotVersion,
            manifestSnapshot: manifest as unknown as Prisma.InputJsonValue,
          },
        });
      });

      const updated = await prisma.installedPackage.findUnique({ where: { id: installedPackageId } });
      if (!updated) {
        throw new DomainEngineError("Installed package not found", "not_found");
      }
      return mapInstalledPackage(updated);
    },

    async archiveInstalledPackage(installedPackageId) {
      const row = await prisma.installedPackage.update({
        where: { id: installedPackageId },
        data: { status: "archived", archivedAt: new Date() },
      });
      return mapInstalledPackage(row);
    },

    async listInstalledPackages(workspaceId, includeArchived = false) {
      const rows = await prisma.installedPackage.findMany({
        where: {
          workspaceId,
          ...(includeArchived ? {} : { status: "active" }),
        },
        orderBy: { installedAt: "desc" },
      });
      return rows.map(mapInstalledPackage);
    },

    async loadExecutionContextData(workspaceId, domainKey, domainAction) {
      const globalFacts = await this.listActiveGlobalFacts(workspaceId);
      let domain = null;
      let domainFacts: Awaited<ReturnType<typeof mapDomainFact>>[] = [];
      let instructions: Awaited<ReturnType<typeof mapInstruction>>[] = [];

      if (domainKey) {
        domain = await this.getDomainByKey(workspaceId, domainKey);
        if (domain && domain.status === "active") {
          domainFacts = await this.listActiveDomainFacts(domain.domainId);
          if (domainAction) {
            const active = await this.getActiveInstruction(domain.domainId, domainAction);
            if (active) instructions = [active];
          }
        } else {
          domain = null;
        }
      }

      return { domain, globalFacts, domainFacts, instructions };
    },

    async createOperationalObject(input: CreateOperationalObjectInput) {
      const row = await prisma.operationalObject.create({
        data: {
          id: newUlid(),
          workspaceId: input.workspaceId,
          objectType: input.objectType,
          name: input.name.trim(),
          status: input.status.trim(),
          metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        },
      });
      return mapOperationalObject(row);
    },

    async updateOperationalObject(objectId, input) {
      const existing = await prisma.operationalObject.findUnique({ where: { id: objectId } });
      if (!existing) return null;
      const row = await prisma.operationalObject.update({
        where: { id: objectId },
        data: {
          ...(input.name != null ? { name: input.name.trim() } : {}),
          ...(input.status != null ? { status: input.status.trim() } : {}),
          ...(input.metadata != null ? { metadata: input.metadata as Prisma.InputJsonValue } : {}),
        },
      });
      return mapOperationalObject(row);
    },

    async archiveOperationalObject(objectId) {
      const existing = await prisma.operationalObject.findUnique({ where: { id: objectId } });
      if (!existing) return null;
      const row = await prisma.operationalObject.update({
        where: { id: objectId },
        data: { rowStatus: "archived", archivedAt: new Date() },
      });
      return mapOperationalObject(row);
    },

    async deleteOperationalObject(objectId) {
      await prisma.operationalObject.delete({ where: { id: objectId } });
      return true;
    },

    async getOperationalObject(objectId) {
      const row = await prisma.operationalObject.findUnique({ where: { id: objectId } });
      return row ? mapOperationalObject(row) : null;
    },

    async listOperationalObjects(query: ListOperationalObjectsQuery) {
      const limit = Math.min(Math.max(query.limit ?? 50, 1), 100);
      const rows = await prisma.operationalObject.findMany({
        where: {
          workspaceId: query.workspaceId,
          ...(query.includeArchived ? {} : { rowStatus: "active" }),
          ...(query.objectType ? { objectType: query.objectType } : {}),
          ...(query.status ? { status: query.status } : {}),
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.metadataMatch ? 500 : limit + 1,
      });

      let objects = rows.map(mapOperationalObject);
      if (query.metadataMatch && Object.keys(query.metadataMatch).length > 0) {
        objects = objects.filter((obj) =>
          matchesOperationalObjectMetadata(obj.metadata, query.metadataMatch!),
        );
      }

      const hasMore = objects.length > limit;
      const page = hasMore ? objects.slice(0, limit) : objects;
      const nextCursor = hasMore ? page[page.length - 1]?.objectId : undefined;
      return {
        objects: page,
        ...(nextCursor ? { nextCursor } : {}),
      };
    },
  };
}

async function installPackageTransaction(
  prisma: PrismaClient,
  input: InstallPackageInput,
): Promise<InstalledPackage> {
  const { workspaceId, failOnConflict = true } = input;
  const snapshotVersion = new Date().toISOString();
  const installedPackageId = newUlid();

  return prisma.$transaction(async (tx) => {
    const { manifest, packageDefinitionId } = await resolveManifestForInstall(tx, {
      ...(input.manifest ? { manifest: input.manifest } : {}),
      ...(input.packageDefinitionId ? { packageDefinitionId: input.packageDefinitionId } : {}),
    });

    await applyManifestToWorkspace(tx, {
      workspaceId,
      manifest,
      sourcePackageId: installedPackageId,
      failOnConflict,
    });

    const installed = await tx.installedPackage.create({
      data: {
        id: installedPackageId,
        workspaceId,
        packageDefinitionId,
        packageKey: manifest.packageKey,
        installedVersion: manifest.version,
        snapshotVersion,
        manifestSnapshot: manifest as unknown as Prisma.InputJsonValue,
        snapshotHistory: [] as unknown as Prisma.InputJsonValue,
        ...(input.installedByUserId ? { installedByUserId: input.installedByUserId } : {}),
      },
    });

    return mapInstalledPackage(installed);
  });
}
