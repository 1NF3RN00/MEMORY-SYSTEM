import type {
  Domain,
  Fact,
  InstalledPackage,
  Instruction,
  NormalizedObservation,
  OperationalObject,
  PackageManifest,
  PackageManifestDiff,
  Workflow,
  WorkflowExecutionContext,
  WorkflowInstructionRef,
  WorkflowOutput,
  WorkflowRun,
  WorkflowRunDetail,
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

export interface ObservationProviderSummary {
  providerKey: string;
  name: string;
  categories: string[];
  runnable: boolean;
}

export interface ObservationMetricSummary {
  metricKey: string;
  categoryKey: string;
  providerKey: string;
  valueType: string;
  unit?: string;
  description: string;
}

export async function fetchObservationProviders(): Promise<ObservationProviderSummary[]> {
  const data = await apiGet<{ providers: ObservationProviderSummary[] }>("/observation-providers");
  return data.providers;
}

export async function fetchObservationMetrics(providerKey?: string): Promise<ObservationMetricSummary[]> {
  const query = providerKey ? `?providerKey=${encodeURIComponent(providerKey)}` : "";
  const data = await apiGet<{ metrics: ObservationMetricSummary[] }>(
    `/observation-metrics${query}`,
  );
  return data.metrics;
}

export interface ObservationListFilters {
  provider?: string;
  category?: string;
  metric?: string;
  businessId?: string;
  competitorId?: string;
  collectedAfter?: string;
  collectedBefore?: string;
  limit?: number;
  cursor?: string;
}

export interface ObservationListResult {
  observations: NormalizedObservation[];
  nextCursor?: string;
}

export interface ObservationDetailResult {
  observation: NormalizedObservation;
  lineage: {
    memoryId: string;
    memoryTitle: string;
    createdAt: string;
    ingestionTraceId?: string;
  };
}

export interface CollectObservationResult {
  providerKey: string;
  observationCount: number;
  observationIds: string[];
  collectedAt: string;
}

function buildObservationQuery(
  workspaceId: string,
  filters: ObservationListFilters = {},
): string {
  const params = new URLSearchParams({ workspaceId });
  if (filters.provider) params.set("provider", filters.provider);
  if (filters.category) params.set("category", filters.category);
  if (filters.metric) params.set("metric", filters.metric);
  if (filters.businessId) params.set("businessId", filters.businessId);
  if (filters.competitorId) params.set("competitorId", filters.competitorId);
  if (filters.collectedAfter) params.set("collectedAfter", filters.collectedAfter);
  if (filters.collectedBefore) params.set("collectedBefore", filters.collectedBefore);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", filters.cursor);
  return params.toString();
}

export async function listObservations(
  workspaceId: string,
  filters: ObservationListFilters = {},
): Promise<ObservationListResult> {
  const query = buildObservationQuery(workspaceId, filters);
  return apiGet<ObservationListResult>(`/observations?${query}`);
}

export async function getObservation(
  workspaceId: string,
  observationId: string,
): Promise<ObservationDetailResult> {
  const params = new URLSearchParams({ workspaceId });
  return apiGet<ObservationDetailResult>(`/observations/${observationId}?${params.toString()}`);
}

export async function collectObservation(
  providerKey: string,
  body: {
    workspaceId: string;
    businessId?: string;
    competitorId?: string;
    params: Record<string, unknown>;
  },
): Promise<CollectObservationResult> {
  return apiPost<CollectObservationResult>(`/observation-providers/${providerKey}/collect`, body);
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

export async function fetchOperationalObjects(
  workspaceId: string,
  opts?: { objectType?: string; status?: string },
): Promise<OperationalObject[]> {
  const params = new URLSearchParams({ workspaceId });
  if (opts?.objectType) params.set("objectType", opts.objectType);
  if (opts?.status) params.set("status", opts.status);
  const data = await apiGet<{ objects: OperationalObject[] }>(`/objects?${params.toString()}`);
  return data.objects;
}

export async function createOperationalObjectApi(
  workspaceId: string,
  body: Record<string, unknown>,
): Promise<OperationalObject> {
  const data = await apiPost<{ object: OperationalObject }>("/objects", { workspaceId, ...body });
  return data.object;
}

export async function updateOperationalObjectApi(
  workspaceId: string,
  objectId: string,
  body: Record<string, unknown>,
): Promise<OperationalObject> {
  const data = await apiPatch<{ object: OperationalObject }>(`/objects/${objectId}`, {
    workspaceId,
    ...body,
  });
  return data.object;
}

export async function archiveOperationalObjectApi(
  workspaceId: string,
  objectId: string,
): Promise<OperationalObject> {
  const data = await apiPost<{ object: OperationalObject }>(`/objects/${objectId}/archive`, {
    workspaceId,
  });
  return data.object;
}

export async function fetchWorkflows(workspaceId: string): Promise<Workflow[]> {
  const data = await apiGet<{ workflows: Workflow[] }>(`/workflows?workspaceId=${workspaceId}`);
  return data.workflows;
}

export async function fetchWorkflow(workspaceId: string, workflowId: string): Promise<Workflow> {
  const data = await apiGet<{ workflow: Workflow }>(
    `/workflows/${workflowId}?workspaceId=${workspaceId}`,
  );
  return data.workflow;
}

export async function fetchWorkflowExecutionContext(
  workspaceId: string,
  workflowId: string,
  previousRunLimit?: number,
): Promise<WorkflowExecutionContext> {
  const params = new URLSearchParams({ workspaceId });
  if (previousRunLimit != null) params.set("previousRunLimit", String(previousRunLimit));
  const data = await apiGet<{ executionContext: WorkflowExecutionContext }>(
    `/workflows/${workflowId}/execution-context?${params.toString()}`,
  );
  return data.executionContext;
}

export async function createWorkflowApi(
  workspaceId: string,
  body: Record<string, unknown>,
): Promise<Workflow> {
  const data = await apiPost<{ workflow: Workflow }>("/workflows", { workspaceId, ...body });
  return data.workflow;
}

export async function updateWorkflowApi(
  workspaceId: string,
  workflowId: string,
  body: Record<string, unknown>,
): Promise<Workflow> {
  const data = await apiPatch<{ workflow: Workflow }>(`/workflows/${workflowId}`, {
    workspaceId,
    ...body,
  });
  return data.workflow;
}

export async function archiveWorkflowApi(
  workspaceId: string,
  workflowId: string,
): Promise<Workflow> {
  const data = await apiPost<{ workflow: Workflow }>(`/workflows/${workflowId}/archive`, {
    workspaceId,
  });
  return data.workflow;
}

export async function executeWorkflowApi(
  workspaceId: string,
  workflowId: string,
  body: { query: string; tokenBudget?: number; previousRunLimit?: number },
): Promise<{
  workflowRunId: string;
  status: WorkflowRun["status"];
  outputs: WorkflowOutput[];
  executionContext: WorkflowExecutionContext;
}> {
  const data = await apiPost<{
    workflowRunId: string;
    status: WorkflowRun["status"];
    outputs: WorkflowOutput[];
    executionContext: WorkflowExecutionContext;
  }>(`/workflows/${workflowId}/execute`, { workspaceId, ...body });
  return data;
}

export async function fetchWorkflowRuns(
  workspaceId: string,
  workflowId: string,
  limit = 50,
): Promise<WorkflowRun[]> {
  const data = await apiGet<{ runs: WorkflowRun[] }>(
    `/workflows/${workflowId}/runs?workspaceId=${workspaceId}&limit=${limit}`,
  );
  return data.runs;
}

export async function fetchWorkflowRunDetail(
  workspaceId: string,
  workflowRunId: string,
): Promise<WorkflowRunDetail> {
  const data = await apiGet<{ run: WorkflowRunDetail }>(
    `/workflow-runs/${workflowRunId}?workspaceId=${workspaceId}`,
  );
  return data.run;
}

export interface WorkflowRunReplayResponse {
  replayId: string;
  retrievalTraceId: string;
  workspaceId: string;
  originalQuery: string;
  integrityHash: string;
  replayTimestamp?: string;
  workflowReplay?: {
    workflowId: string;
    workflowRunId: string;
    workspaceId: string;
    executionContext: WorkflowExecutionContext;
    outputs: WorkflowOutput[];
    generatedFactIds: string[];
    generatedMemoryIds: string[];
    generatedObjectIds: string[];
  };
}

export async function fetchWorkflowRunReplay(
  workspaceId: string,
  workflowRunId: string,
): Promise<WorkflowRunReplayResponse> {
  const data = await apiGet<{ replay: WorkflowRunReplayResponse }>(
    `/workflow-runs/${workflowRunId}/replay?workspaceId=${workspaceId}`,
  );
  return data.replay;
}

export async function archiveWorkflowRunApi(
  workspaceId: string,
  workflowRunId: string,
): Promise<WorkflowRun> {
  const data = await apiPost<{ run: WorkflowRun }>(`/workflow-runs/${workflowRunId}/archive`, {
    workspaceId,
  });
  return data.run;
}

export function parseInstructionRefsJson(value: string): WorkflowInstructionRef[] {
  const parsed = JSON.parse(value) as unknown;
  if (!Array.isArray(parsed)) throw new Error("Instruction refs must be a JSON array");
  return parsed.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      throw new Error(`Instruction ref at index ${index} must be an object`);
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.domainKey !== "string" || typeof obj.actionKey !== "string") {
      throw new Error(`Instruction ref at index ${index} requires domainKey and actionKey`);
    }
    return { domainKey: obj.domainKey, actionKey: obj.actionKey };
  });
}

export function formatInstructionRefs(refs: WorkflowInstructionRef[] | undefined): string {
  return JSON.stringify(refs ?? [], null, 2);
}
