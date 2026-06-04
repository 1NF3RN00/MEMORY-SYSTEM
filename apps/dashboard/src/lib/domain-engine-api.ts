import type {
  Domain,
  Fact,
  InstalledPackage,
  Instruction,
  PackageManifest,
  PackageManifestDiff,
} from "@memory-middleware/shared-types";
import { apiGet, apiPatch, apiPost } from "./api.js";

export function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function formatCommaList(items: string[] | undefined): string {
  return items?.join(", ") ?? "";
}

export async function fetchDomains(workspaceId: string): Promise<Domain[]> {
  const data = await apiGet<{ domains: Domain[] }>(`/domains?workspaceId=${workspaceId}`);
  return data.domains;
}

export async function fetchDomain(workspaceId: string, domainId: string): Promise<Domain> {
  const data = await apiGet<{ domain: Domain }>(
    `/domains/${domainId}?workspaceId=${workspaceId}`,
  );
  return data.domain;
}

export async function createDomainApi(
  workspaceId: string,
  body: Record<string, unknown>,
): Promise<Domain> {
  const data = await apiPost<{ domain: Domain }>("/domains", { workspaceId, ...body });
  return data.domain;
}

export async function updateDomainApi(
  workspaceId: string,
  domainId: string,
  body: Record<string, unknown>,
): Promise<Domain> {
  const data = await apiPatch<{ domain: Domain }>(`/domains/${domainId}`, {
    workspaceId,
    ...body,
  });
  return data.domain;
}

export async function archiveDomainApi(workspaceId: string, domainId: string): Promise<Domain> {
  const data = await apiPost<{ domain: Domain }>(`/domains/${domainId}/archive`, { workspaceId });
  return data.domain;
}

export async function fetchGlobalFacts(workspaceId: string): Promise<Fact[]> {
  const data = await apiGet<{ facts: Fact[] }>(`/global-facts?workspaceId=${workspaceId}`);
  return data.facts;
}

export async function createGlobalFactApi(
  workspaceId: string,
  body: Record<string, unknown>,
): Promise<Fact> {
  const data = await apiPost<{ fact: Fact }>("/global-facts", { workspaceId, ...body });
  return data.fact;
}

export async function updateGlobalFactApi(
  workspaceId: string,
  factId: string,
  body: Record<string, unknown>,
): Promise<Fact> {
  const data = await apiPatch<{ fact: Fact }>(`/global-facts/${factId}`, {
    workspaceId,
    ...body,
  });
  return data.fact;
}

export async function archiveGlobalFactApi(workspaceId: string, factId: string): Promise<Fact> {
  const data = await apiPost<{ fact: Fact }>(`/global-facts/${factId}/archive`, { workspaceId });
  return data.fact;
}

export async function fetchDomainFacts(workspaceId: string, domainId: string): Promise<Fact[]> {
  const data = await apiGet<{ facts: Fact[] }>(
    `/domains/${domainId}/facts?workspaceId=${workspaceId}`,
  );
  return data.facts;
}

export async function createDomainFactApi(
  workspaceId: string,
  domainId: string,
  body: Record<string, unknown>,
): Promise<Fact> {
  const data = await apiPost<{ fact: Fact }>(`/domains/${domainId}/facts`, {
    workspaceId,
    ...body,
  });
  return data.fact;
}

export async function updateDomainFactApi(
  workspaceId: string,
  factId: string,
  body: Record<string, unknown>,
): Promise<Fact> {
  const data = await apiPatch<{ fact: Fact }>(`/domain-facts/${factId}`, {
    workspaceId,
    ...body,
  });
  return data.fact;
}

export async function archiveDomainFactApi(workspaceId: string, factId: string): Promise<Fact> {
  const data = await apiPost<{ fact: Fact }>(`/domain-facts/${factId}/archive`, { workspaceId });
  return data.fact;
}

export async function fetchInstructions(
  workspaceId: string,
  domainId: string,
): Promise<Instruction[]> {
  const data = await apiGet<{ instructions: Instruction[] }>(
    `/domains/${domainId}/instructions?workspaceId=${workspaceId}`,
  );
  return data.instructions;
}

export async function fetchInstructionVersions(
  workspaceId: string,
  domainId: string,
  actionKey: string,
): Promise<Instruction[]> {
  const data = await apiGet<{ versions: Instruction[] }>(
    `/domains/${domainId}/instructions/${encodeURIComponent(actionKey)}/versions?workspaceId=${workspaceId}`,
  );
  return data.versions;
}

export async function createInstructionApi(
  workspaceId: string,
  domainId: string,
  body: Record<string, unknown>,
): Promise<Instruction> {
  const data = await apiPost<{ instruction: Instruction }>(
    `/domains/${domainId}/instructions`,
    { workspaceId, ...body },
  );
  return data.instruction;
}

export async function versionInstructionApi(
  workspaceId: string,
  domainId: string,
  actionKey: string,
  body: Record<string, unknown>,
): Promise<Instruction> {
  const data = await apiPost<{ instruction: Instruction }>(
    `/domains/${domainId}/instructions/${encodeURIComponent(actionKey)}/version`,
    { workspaceId, ...body },
  );
  return data.instruction;
}

export async function archiveInstructionApi(
  workspaceId: string,
  instructionId: string,
): Promise<Instruction> {
  const data = await apiPost<{ instruction: Instruction }>(
    `/instructions/${instructionId}/archive`,
    { workspaceId },
  );
  return data.instruction;
}

export async function fetchInstalledPackages(workspaceId: string): Promise<InstalledPackage[]> {
  const data = await apiGet<{ packages: InstalledPackage[] }>(
    `/packages/installed?workspaceId=${workspaceId}`,
  );
  return data.packages;
}

export async function exportPackageApi(
  workspaceId: string,
  installedPackageId: string,
): Promise<PackageManifest> {
  const data = await apiPost<{ manifest: PackageManifest }>("/packages/export", {
    workspaceId,
    installedPackageId,
  });
  return data.manifest;
}

export async function installPackageApi(
  workspaceId: string,
  manifest: PackageManifest,
  failOnConflict = true,
): Promise<InstalledPackage> {
  const data = await apiPost<{ installed: InstalledPackage }>("/packages/install", {
    workspaceId,
    manifest,
    failOnConflict,
  });
  return data.installed;
}

export async function comparePackageApi(
  workspaceId: string,
  installedPackageId: string,
  candidateManifest: PackageManifest,
): Promise<PackageManifestDiff> {
  const data = await apiPost<{ diff: PackageManifestDiff }>("/packages/compare", {
    workspaceId,
    installedPackageId,
    candidateManifest,
  });
  return data.diff;
}

export async function archiveInstalledPackageApi(
  workspaceId: string,
  installedPackageId: string,
): Promise<InstalledPackage> {
  const data = await apiPost<{ installed: InstalledPackage }>(
    `/packages/installed/${installedPackageId}/archive`,
    { workspaceId },
  );
  return data.installed;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
