import type { EventEmitter } from "@memory-middleware/observability";
import type {
  InstalledPackage,
  PackageManifest,
  PackageManifestDiff,
} from "@memory-middleware/shared-types";
import { DOMAIN_ENGINE_EVENT_TYPES } from "@memory-middleware/shared-types";
import { comparePackageManifests } from "./compare-manifest.js";
import { assertDomainSlug, DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type { DomainEngineStore, InstallPackageInput } from "./store.js";

export interface PackageEngineDeps {
  store: DomainEngineStore;
  events: EventEmitter;
  traceId: string;
}

function validateManifest(manifest: PackageManifest): void {
  assertDomainSlug(manifest.packageKey, "packageKey");
  for (const d of manifest.domains) {
    assertDomainSlug(d.domainKey, "domainKey");
    for (const ins of d.instructions ?? []) {
      assertDomainSlug(ins.actionKey, "actionKey");
    }
    for (const f of d.facts ?? []) {
      assertDomainSlug(f.key, "fact key");
    }
  }
  for (const f of manifest.globalFacts ?? []) {
    assertDomainSlug(f.key, "fact key");
  }
  for (const workflow of manifest.workflows ?? []) {
    assertDomainSlug(workflow.workflowKey, "workflowKey");
    if (!workflow.analysisSpecKey.trim()) {
      throw new DomainEngineError(
        `analysisSpecKey is required for workflow ${workflow.workflowKey}`,
        "validation",
      );
    }
  }
}

async function resolveInstallManifest(
  store: DomainEngineStore,
  input: InstallPackageInput,
): Promise<PackageManifest> {
  if (input.manifest) return input.manifest;
  if (input.packageDefinitionId) {
    const def = await store.getPackageDefinition(input.packageDefinitionId);
    if (!def) {
      throw new DomainEngineError(
        `Package definition not found: ${input.packageDefinitionId}`,
        "not_found",
      );
    }
    return def.manifest;
  }
  if (input.packageKey) {
    const def = await store.getPackageDefinitionByKey(input.packageKey);
    if (!def) {
      throw new DomainEngineError(`Package definition not found: ${input.packageKey}`, "not_found");
    }
    return def.manifest;
  }
  throw new DomainEngineError(
    "manifest, packageDefinitionId, or packageKey is required",
    "invalid_request",
  );
}

export async function installPackage(
  deps: PackageEngineDeps,
  input: InstallPackageInput,
): Promise<InstalledPackage> {
  const manifest = await resolveInstallManifest(deps.store, input);
  validateManifest(manifest);
  const installed = await deps.store.installPackage({ ...input, manifest });
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.PACKAGE_INSTALLED, {
    traceId: deps.traceId,
    workspaceId: input.workspaceId,
    extra: {
      installedPackageId: installed.installedPackageId,
      packageKey: installed.packageKey,
      version: installed.installedVersion,
    },
  });
  return installed;
}

export async function exportPackage(
  deps: PackageEngineDeps,
  installedPackageId: string,
  workspaceId: string,
): Promise<PackageManifest> {
  const manifest = await deps.store.exportInstalledPackage(installedPackageId);
  if (!manifest) {
    throw new DomainEngineError(
      `Installed package not found: ${installedPackageId}`,
      "not_found",
    );
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.PACKAGE_EXPORTED, {
    traceId: deps.traceId,
    workspaceId,
    extra: { installedPackageId, packageKey: manifest.packageKey },
  });
  return manifest;
}

export async function clonePackage(
  deps: PackageEngineDeps,
  sourceInstalledPackageId: string,
  targetWorkspaceId: string,
  installedByUserId?: string,
): Promise<InstalledPackage> {
  const installed = await deps.store.cloneInstalledPackage(
    sourceInstalledPackageId,
    targetWorkspaceId,
    installedByUserId,
  );
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.PACKAGE_INSTALLED, {
    traceId: deps.traceId,
    workspaceId: targetWorkspaceId,
    extra: {
      installedPackageId: installed.installedPackageId,
      packageKey: installed.packageKey,
      clonedFrom: sourceInstalledPackageId,
    },
  });
  return installed;
}

export async function updatePackage(
  deps: PackageEngineDeps,
  installedPackageId: string,
  workspaceId: string,
  manifest: PackageManifest,
  failOnConflict = true,
): Promise<InstalledPackage> {
  validateManifest(manifest);
  const updated = await deps.store.updateInstalledPackageFromManifest(
    installedPackageId,
    manifest,
    failOnConflict,
  );
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.PACKAGE_UPDATED, {
    traceId: deps.traceId,
    workspaceId,
    extra: {
      installedPackageId,
      packageKey: updated.packageKey,
      version: updated.installedVersion,
    },
  });
  return updated;
}

export async function comparePackage(
  deps: PackageEngineDeps,
  installedPackageId: string,
  candidateManifest: PackageManifest,
): Promise<PackageManifestDiff> {
  const current = await deps.store.exportInstalledPackage(installedPackageId);
  if (!current) {
    throw new DomainEngineError(
      `Installed package not found: ${installedPackageId}`,
      "not_found",
    );
  }
  if (current.packageKey !== candidateManifest.packageKey) {
    throw new DomainEngineError(
      `Package key mismatch: ${current.packageKey} vs ${candidateManifest.packageKey}`,
      "invalid_request",
    );
  }
  return comparePackageManifests(current, candidateManifest);
}

export async function rollbackPackage(
  deps: PackageEngineDeps,
  installedPackageId: string,
  workspaceId: string,
  snapshotVersion: string,
): Promise<InstalledPackage> {
  const rolled = await deps.store.rollbackInstalledPackage(installedPackageId, snapshotVersion);
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.PACKAGE_UPDATED, {
    traceId: deps.traceId,
    workspaceId,
    extra: {
      installedPackageId,
      packageKey: rolled.packageKey,
      snapshotVersion,
      rollback: true,
    },
  });
  return rolled;
}

export async function archiveInstalledPackage(
  deps: PackageEngineDeps,
  installedPackageId: string,
  workspaceId: string,
): Promise<InstalledPackage> {
  const archived = await deps.store.archiveInstalledPackage(installedPackageId);
  if (!archived) {
    throw new DomainEngineError(
      `Installed package not found: ${installedPackageId}`,
      "not_found",
    );
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.PACKAGE_ARCHIVED, {
    traceId: deps.traceId,
    workspaceId,
    extra: { installedPackageId, packageKey: archived.packageKey },
  });
  return archived;
}
