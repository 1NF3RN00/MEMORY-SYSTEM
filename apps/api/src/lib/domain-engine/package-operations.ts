import { DomainEngineError } from "@memory-middleware/domain-engine";
import type {
  Fact,
  Instruction,
  ManifestDomainFact,
  ManifestGlobalFact,
  ManifestInstruction,
  ManifestRetrievalRule,
  PackageManifest,
  PackageManifestDomain,
  PackageSnapshotRecord,
  PackageWorkflowRef,
  Workflow,
  WorkflowInstructionRef,
} from "@memory-middleware/shared-types";
import { DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT } from "@memory-middleware/shared-types";
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  mapDomain,
  mapDomainFact,
  mapGlobalFact,
  mapInstruction,
  mapWorkflow,
  parseRetrievalRuleConfig,
  retrievalRuleToConfig,
} from "./mappers.js";
import { newUlid } from "@memory-middleware/shared-types";

export type PackageManifestDomainInput = PackageManifest["domains"][number];

async function installedPackageKey(
  tx: Prisma.TransactionClient,
  installedPackageId: string | null | undefined,
): Promise<string | null> {
  if (!installedPackageId) return null;
  const row = await tx.installedPackage.findUnique({
    where: { id: installedPackageId },
    select: { packageKey: true },
  });
  return row?.packageKey ?? null;
}

function factToManifestGlobal(fact: Fact): ManifestGlobalFact {
  return {
    scope: "global",
    key: fact.key,
    title: fact.title,
    content: fact.content,
    priority: fact.priority,
    status: fact.status,
    ...(fact.appliesToMetadataKeys?.length
      ? { appliesToMetadataKeys: fact.appliesToMetadataKeys }
      : {}),
  };
}

function factToManifestDomain(fact: Fact): ManifestDomainFact {
  return {
    scope: "domain",
    key: fact.key,
    title: fact.title,
    content: fact.content,
    priority: fact.priority,
    status: fact.status,
    ...(fact.appliesToMetadataKeys?.length
      ? { appliesToMetadataKeys: fact.appliesToMetadataKeys }
      : {}),
  };
}

function instructionToManifest(instruction: Instruction): ManifestInstruction {
  return {
    actionKey: instruction.actionKey,
    title: instruction.title,
    content: instruction.content,
    status: instruction.status,
  };
}

function ruleToManifest(
  rule: ReturnType<typeof parseRetrievalRuleConfig>,
): ManifestRetrievalRule {
  const { ruleId: _ruleId, domainId: _domainId, ...rest } = rule;
  return rest;
}

function workflowToManifest(workflow: Workflow): PackageWorkflowRef {
  return {
    workflowKey: workflow.workflowKey ?? workflow.workflowId,
    name: workflow.name,
    ...(workflow.description ? { description: workflow.description } : {}),
    domains: workflow.domains,
    outputTypes: workflow.outputTypes,
    analysisSpecKey: workflow.analysisSpecKey ?? "",
  };
}

function buildInstructionRefsForWorkflow(
  workflow: PackageWorkflowRef,
  manifest: PackageManifest,
): WorkflowInstructionRef[] {
  const refs: WorkflowInstructionRef[] = [];
  for (const domainKey of workflow.domains) {
    const domain = manifest.domains.find((entry) => entry.domainKey === domainKey);
    const instruction = domain?.instructions?.[0];
    if (instruction) {
      refs.push({ domainKey, actionKey: instruction.actionKey });
    }
  }
  return refs;
}

export async function applyWorkflowsFromManifest(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    manifest: PackageManifest;
    sourcePackageId: string;
    failOnConflict?: boolean;
  },
): Promise<void> {
  const { workspaceId, manifest, sourcePackageId, failOnConflict = true } = input;

  for (const workflowRef of manifest.workflows ?? []) {
    if (!workflowRef.workflowKey.trim()) {
      throw new DomainEngineError("workflowKey is required in package workflows", "validation");
    }
    if (!workflowRef.analysisSpecKey.trim()) {
      throw new DomainEngineError(
        `analysisSpecKey is required for workflow ${workflowRef.workflowKey}`,
        "validation",
      );
    }

    const instructionRefs = buildInstructionRefsForWorkflow(workflowRef, manifest);
    const existing = await tx.workflow.findFirst({
      where: {
        workspaceId,
        workflowKey: workflowRef.workflowKey,
      },
    });

    const workflowData = {
      name: workflowRef.name,
      description: workflowRef.description?.trim() ?? "",
      workflowKey: workflowRef.workflowKey,
      analysisSpecKey: workflowRef.analysisSpecKey,
      domains: workflowRef.domains as Prisma.InputJsonValue,
      packages: [manifest.packageKey] as Prisma.InputJsonValue,
      instructionRefs: instructionRefs as unknown as Prisma.InputJsonValue,
      outputTypes: workflowRef.outputTypes as Prisma.InputJsonValue,
      sourcePackageId,
      active: true,
      archivedAt: null,
    };

    if (existing) {
      if (existing.sourcePackageId && existing.sourcePackageId !== sourcePackageId) {
        if (failOnConflict) {
          const ownerKey = await installedPackageKey(tx, existing.sourcePackageId);
          const ownerLabel = ownerKey ? `package "${ownerKey}"` : "another installed package";
          throw new DomainEngineError(
            `Workflow key conflict: "${workflowRef.workflowKey}" already exists from ${ownerLabel}. ` +
              "Archive that package, rename workflowKey in your manifest, or install with failOnConflict: false to skip duplicates.",
            "conflict",
          );
        }
        continue;
      }
      await tx.workflow.update({
        where: { id: existing.id },
        data: workflowData,
      });
      continue;
    }

    await tx.workflow.create({
      data: {
        id: newUlid(),
        workspaceId,
        ...workflowData,
      },
    });
  }
}

export function parseSnapshotHistory(value: unknown): PackageSnapshotRecord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is PackageSnapshotRecord =>
      entry != null &&
      typeof entry === "object" &&
      typeof (entry as PackageSnapshotRecord).snapshotVersion === "string" &&
      typeof (entry as PackageSnapshotRecord).savedAt === "string" &&
      (entry as PackageSnapshotRecord).manifest != null,
  );
}

export async function buildManifestFromInstalledPackage(
  prisma: PrismaClient,
  installedPackageId: string,
  workspaceId: string,
): Promise<PackageManifest | null> {
  const installed = await prisma.installedPackage.findUnique({
    where: { id: installedPackageId },
  });
  if (!installed || installed.workspaceId !== workspaceId) return null;

  const globalRows = await prisma.globalFact.findMany({
    where: { workspaceId, sourcePackageId: installedPackageId, status: "active" },
    orderBy: { key: "asc" },
  });

  const domainRows = await prisma.domain.findMany({
    where: { workspaceId, sourcePackageId: installedPackageId, status: "active" },
    include: {
      retrievalRules: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { domainKey: "asc" },
  });

  const domains: PackageManifestDomain[] = [];
  for (const row of domainRows) {
    const domain = mapDomain(row, row.retrievalRules);
    const factRows = await prisma.domainFact.findMany({
      where: { domainId: row.id, sourcePackageId: installedPackageId, status: "active" },
      orderBy: { key: "asc" },
    });
    const instructionRows = await prisma.domainInstruction.findMany({
      where: {
        domainId: row.id,
        sourcePackageId: installedPackageId,
        status: "active",
        isActive: true,
      },
      orderBy: { actionKey: "asc" },
    });

    const domainManifest: PackageManifestDomain = {
      domainKey: domain.domainKey,
      name: domain.name,
      retrievalRules: domain.retrievalRules.map(ruleToManifest),
      metadataFilters: domain.metadataFilters,
      ...(domain.observationFilters.length > 0
        ? { observationFilters: domain.observationFilters }
        : {}),
      relationshipConstraints: domain.relationshipConstraints,
      ...(domain.description ? { description: domain.description } : {}),
      ...(factRows.length > 0
        ? { facts: factRows.map((r) => factToManifestDomain(mapDomainFact(r))) }
        : {}),
      ...(instructionRows.length > 0
        ? {
            instructions: instructionRows.map((r) =>
              instructionToManifest(mapInstruction(r)),
            ),
          }
        : {}),
    };
    domains.push(domainManifest);
  }

  const workflowRows = await prisma.workflow.findMany({
    where: { workspaceId, sourcePackageId: installedPackageId, active: true },
    orderBy: { workflowKey: "asc" },
  });

  const manifest: PackageManifest = {
    packageKey: installed.packageKey,
    name: installed.packageKey,
    version: installed.installedVersion,
    domains,
    ...(globalRows.length > 0
      ? { globalFacts: globalRows.map((r) => factToManifestGlobal(mapGlobalFact(r))) }
      : {}),
    ...(workflowRows.length > 0
      ? {
          workflows: workflowRows
            .map((row) => mapWorkflow(row))
            .filter((workflow) => Boolean(workflow.analysisSpecKey))
            .map((workflow) => workflowToManifest(workflow)),
        }
      : {}),
  };

  const def = await prisma.packageDefinition.findUnique({
    where: { id: installed.packageDefinitionId },
  });
  if (def) {
    manifest.name = def.name;
    if (def.description) manifest.description = def.description;
  }

  return manifest;
}

export async function applyManifestToWorkspace(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    manifest: PackageManifest;
    sourcePackageId: string;
    failOnConflict?: boolean;
  },
): Promise<void> {
  const { manifest, workspaceId, sourcePackageId, failOnConflict = true } = input;

  for (const gf of manifest.globalFacts ?? []) {
    const conflict = await tx.globalFact.findUnique({
      where: { workspaceId_key: { workspaceId, key: gf.key } },
    });
    if (conflict && failOnConflict) {
      const ownerKey = await installedPackageKey(tx, conflict.sourcePackageId);
      const ownerLabel = ownerKey ? `package "${ownerKey}"` : "another installed package";
      throw new DomainEngineError(
        `Global fact key conflict: "${gf.key}" already exists from ${ownerLabel}. ` +
          "Archive that package, rename the key in your manifest, or install with failOnConflict: false to skip duplicates.",
        "conflict",
      );
    }
    if (!conflict) {
      await tx.globalFact.create({
        data: {
          id: newUlid(),
          workspaceId,
          key: gf.key,
          title: gf.title,
          content: gf.content,
          priority: gf.priority ?? 0,
          status: gf.status ?? "active",
          appliesToMetadataKeys: (gf.appliesToMetadataKeys ?? []) as Prisma.InputJsonValue,
          sourcePackageId,
        },
      });
    } else if (conflict.sourcePackageId === sourcePackageId) {
      await tx.globalFact.update({
        where: { id: conflict.id },
        data: {
          title: gf.title,
          content: gf.content,
          priority: gf.priority ?? conflict.priority,
          status: gf.status ?? "active",
          appliesToMetadataKeys: (gf.appliesToMetadataKeys ?? []) as Prisma.InputJsonValue,
        },
      });
    }
  }

  for (const md of manifest.domains) {
    await upsertDomainFromManifest(tx, workspaceId, md, sourcePackageId, failOnConflict);
  }

  if (manifest.workflows?.length) {
    await applyWorkflowsFromManifest(tx, {
      workspaceId,
      manifest,
      sourcePackageId,
      failOnConflict,
    });
  }
}

export async function upsertDomainFromManifest(
  tx: Prisma.TransactionClient,
  workspaceId: string,
  md: PackageManifestDomainInput,
  sourcePackageId: string,
  failOnConflict: boolean,
): Promise<string> {
  const existing = await tx.domain.findUnique({
    where: { workspaceId_domainKey: { workspaceId, domainKey: md.domainKey } },
  });

  let domainId: string;
  if (existing) {
    domainId = existing.id;
    await tx.domain.update({
      where: { id: domainId },
      data: {
        name: md.name,
        ...(md.description !== undefined ? { description: md.description } : {}),
        metadataFilters: md.metadataFilters as Prisma.InputJsonValue,
        observationFilters: (md.observationFilters ?? []) as unknown as Prisma.InputJsonValue,
        relationshipConstraints: (md.relationshipConstraints ??
          DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT) as unknown as Prisma.InputJsonValue,
        sourcePackageId,
        status: "active",
        archivedAt: null,
      },
    });
    await tx.domainRetrievalRule.deleteMany({ where: { domainId } });
  } else {
    domainId = newUlid();
    await tx.domain.create({
      data: {
        id: domainId,
        workspaceId,
        domainKey: md.domainKey,
        name: md.name,
        ...(md.description ? { description: md.description } : {}),
        metadataFilters: md.metadataFilters as Prisma.InputJsonValue,
        observationFilters: (md.observationFilters ?? []) as unknown as Prisma.InputJsonValue,
        relationshipConstraints: (md.relationshipConstraints ??
          DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT) as unknown as Prisma.InputJsonValue,
        sourcePackageId,
      },
    });
  }

  if (md.retrievalRules.length > 0) {
    await tx.domainRetrievalRule.createMany({
      data: md.retrievalRules.map((rule, index) => ({
        id: newUlid(),
        domainId,
        name: rule.name,
        config: retrievalRuleToConfig(rule) as Prisma.InputJsonValue,
        sortOrder: index,
      })),
    });
  }

  for (const f of md.facts ?? []) {
    const conflict = await tx.domainFact.findUnique({
      where: { domainId_key: { domainId, key: f.key } },
    });
    if (conflict && failOnConflict) {
      const ownerKey = await installedPackageKey(tx, conflict.sourcePackageId);
      const ownerLabel = ownerKey ? `package "${ownerKey}"` : "another installed package";
      throw new DomainEngineError(
        `Domain fact key conflict: domain "${md.domainKey}" fact "${f.key}" already exists from ${ownerLabel}. ` +
          "Archive that package, rename the key, or install with failOnConflict: false to skip duplicates.",
        "conflict",
      );
    }
    if (!conflict) {
      await tx.domainFact.create({
        data: {
          id: newUlid(),
          workspaceId,
          domainId,
          key: f.key,
          title: f.title,
          content: f.content,
          priority: f.priority ?? 0,
          status: f.status ?? "active",
          appliesToMetadataKeys: (f.appliesToMetadataKeys ?? []) as Prisma.InputJsonValue,
          sourcePackageId,
        },
      });
    } else if (conflict.sourcePackageId === sourcePackageId) {
      await tx.domainFact.update({
        where: { id: conflict.id },
        data: {
          title: f.title,
          content: f.content,
          priority: f.priority ?? conflict.priority,
          status: f.status ?? "active",
          appliesToMetadataKeys: (f.appliesToMetadataKeys ?? []) as Prisma.InputJsonValue,
        },
      });
    }
  }

  for (const ins of md.instructions ?? []) {
    const active = await tx.domainInstruction.findFirst({
      where: { domainId, actionKey: ins.actionKey, isActive: true },
    });
    if (active && failOnConflict && active.sourcePackageId !== sourcePackageId) {
      const ownerKey = await installedPackageKey(tx, active.sourcePackageId);
      const ownerLabel = ownerKey ? `package "${ownerKey}"` : "another installed package";
      throw new DomainEngineError(
        `Instruction actionKey conflict: domain "${md.domainKey}" action "${ins.actionKey}" is already active from ${ownerLabel}. ` +
          "Each domain allows one active instruction per actionKey. Archive the other package, rename actionKey in your manifest, or install with failOnConflict: false to skip conflicting instructions.",
        "conflict",
      );
    }
    if (!active) {
      await tx.domainInstruction.create({
        data: {
          id: newUlid(),
          workspaceId,
          domainId,
          actionKey: ins.actionKey,
          title: ins.title,
          content: ins.content,
          status: ins.status ?? "active",
          sourcePackageId,
        },
      });
    } else if (active.sourcePackageId === sourcePackageId) {
      await tx.domainInstruction.update({
        where: { id: active.id },
        data: {
          title: ins.title,
          content: ins.content,
          status: ins.status ?? "active",
        },
      });
    }
  }

  return domainId;
}

export async function resolveManifestForInstall(
  tx: Prisma.TransactionClient,
  input: { manifest?: PackageManifest; packageDefinitionId?: string },
): Promise<{ manifest: PackageManifest; packageDefinitionId: string }> {
  if (input.manifest && input.packageDefinitionId) {
    return { manifest: input.manifest, packageDefinitionId: input.packageDefinitionId };
  }
  if (input.manifest) {
    const def = await tx.packageDefinition.upsert({
      where: { packageKey: input.manifest.packageKey },
      create: {
        id: newUlid(),
        packageKey: input.manifest.packageKey,
        name: input.manifest.name,
        version: input.manifest.version,
        ...(input.manifest.description ? { description: input.manifest.description } : {}),
        manifest: input.manifest as unknown as Prisma.InputJsonValue,
        published: false,
      },
      update: {
        name: input.manifest.name,
        version: input.manifest.version,
        manifest: input.manifest as unknown as Prisma.InputJsonValue,
      },
    });
    return { manifest: input.manifest, packageDefinitionId: def.id };
  }
  if (input.packageDefinitionId) {
    const def = await tx.packageDefinition.findUnique({
      where: { id: input.packageDefinitionId },
    });
    if (!def) {
      throw new DomainEngineError("Package definition not found", "not_found");
    }
    return {
      manifest: def.manifest as unknown as PackageManifest,
      packageDefinitionId: def.id,
    };
  }
  throw new DomainEngineError("manifest or packageDefinitionId is required", "invalid_request");
}
