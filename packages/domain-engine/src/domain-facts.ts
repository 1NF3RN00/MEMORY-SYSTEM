import type { EventEmitter } from "@memory-middleware/observability";
import type { Fact } from "@memory-middleware/shared-types";
import { DOMAIN_ENGINE_EVENT_TYPES } from "@memory-middleware/shared-types";
import { assertDomainSlug, DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type {
  CreateDomainFactInput,
  DomainEngineStore,
  UpdateDomainFactInput,
} from "./store.js";

export interface DomainFactEngineDeps {
  store: DomainEngineStore;
  events: EventEmitter;
  traceId: string;
}

export async function addFact(
  deps: DomainFactEngineDeps,
  input: CreateDomainFactInput,
): Promise<Fact> {
  assertDomainSlug(input.key, "fact key");
  const domain = await deps.store.getDomainById(input.domainId);
  if (!domain || domain.workspaceId !== input.workspaceId) {
    throw new DomainEngineError(`Domain not found: ${input.domainId}`, "not_found");
  }
  const fact = await deps.store.createDomainFact(input);
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.DOMAIN_FACT_CREATED, {
    traceId: deps.traceId,
    workspaceId: input.workspaceId,
    extra: { factId: fact.factId, domainId: input.domainId, key: fact.key },
  });
  return fact;
}

export async function updateFact(
  deps: DomainFactEngineDeps,
  factId: string,
  input: UpdateDomainFactInput,
): Promise<Fact> {
  const fact = await deps.store.updateDomainFact(factId, input);
  if (!fact) {
    throw new DomainEngineError(`Domain fact not found: ${factId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.DOMAIN_FACT_UPDATED, {
    traceId: deps.traceId,
    workspaceId: fact.workspaceId,
    extra: { factId: fact.factId, domainId: fact.domainId, key: fact.key },
  });
  return fact;
}

export async function archiveFact(
  deps: DomainFactEngineDeps,
  factId: string,
): Promise<Fact> {
  const fact = await deps.store.archiveDomainFact(factId);
  if (!fact) {
    throw new DomainEngineError(`Domain fact not found: ${factId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.DOMAIN_FACT_ARCHIVED, {
    traceId: deps.traceId,
    workspaceId: fact.workspaceId,
    extra: { factId: fact.factId, domainId: fact.domainId, key: fact.key },
  });
  return fact;
}

export async function deleteFact(
  deps: DomainFactEngineDeps,
  factId: string,
): Promise<void> {
  const existing = await deps.store.getDomainFact(factId);
  if (!existing) {
    throw new DomainEngineError(`Domain fact not found: ${factId}`, "not_found");
  }
  const deleted = await deps.store.deleteDomainFact(factId);
  if (!deleted) {
    throw new DomainEngineError(`Failed to delete domain fact: ${factId}`, "delete_failed");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.DOMAIN_FACT_DELETED, {
    traceId: deps.traceId,
    workspaceId: existing.workspaceId,
    extra: { factId, domainId: existing.domainId, key: existing.key },
  });
}
