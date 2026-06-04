import type { EventEmitter } from "@memory-middleware/observability";
import type { Domain } from "@memory-middleware/shared-types";
import { DOMAIN_ENGINE_EVENT_TYPES } from "@memory-middleware/shared-types";
import { assertDomainSlug, DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type { CreateDomainInput, DomainEngineStore, UpdateDomainInput } from "./store.js";

export interface DomainEngineDeps {
  store: DomainEngineStore;
  events: EventEmitter;
  traceId: string;
}

export async function createDomain(
  deps: DomainEngineDeps,
  input: CreateDomainInput,
): Promise<Domain> {
  assertDomainSlug(input.domainKey, "domainKey");
  const domain = await deps.store.createDomain(input);
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.DOMAIN_CREATED, {
    traceId: deps.traceId,
    workspaceId: input.workspaceId,
    extra: { domainId: domain.domainId, domainKey: domain.domainKey },
  });
  return domain;
}

export async function updateDomain(
  deps: DomainEngineDeps,
  domainId: string,
  input: UpdateDomainInput,
): Promise<Domain> {
  const domain = await deps.store.updateDomain(domainId, input);
  if (!domain) {
    throw new DomainEngineError(`Domain not found: ${domainId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.DOMAIN_UPDATED, {
    traceId: deps.traceId,
    workspaceId: domain.workspaceId,
    extra: { domainId: domain.domainId, domainKey: domain.domainKey },
  });
  return domain;
}

export async function archiveDomain(
  deps: DomainEngineDeps,
  domainId: string,
): Promise<Domain> {
  const domain = await deps.store.archiveDomain(domainId);
  if (!domain) {
    throw new DomainEngineError(`Domain not found: ${domainId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.DOMAIN_ARCHIVED, {
    traceId: deps.traceId,
    workspaceId: domain.workspaceId,
    extra: { domainId: domain.domainId, domainKey: domain.domainKey },
  });
  return domain;
}

export async function deleteDomain(
  deps: DomainEngineDeps,
  domainId: string,
): Promise<void> {
  const existing = await deps.store.getDomainById(domainId);
  if (!existing) {
    throw new DomainEngineError(`Domain not found: ${domainId}`, "not_found");
  }
  const deleted = await deps.store.deleteDomain(domainId);
  if (!deleted) {
    throw new DomainEngineError(`Failed to delete domain: ${domainId}`, "delete_failed");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.DOMAIN_DELETED, {
    traceId: deps.traceId,
    workspaceId: existing.workspaceId,
    extra: { domainId, domainKey: existing.domainKey },
  });
}
