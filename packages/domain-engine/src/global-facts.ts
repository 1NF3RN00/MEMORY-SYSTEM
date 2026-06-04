import type { EventEmitter } from "@memory-middleware/observability";
import type { Fact } from "@memory-middleware/shared-types";
import { DOMAIN_ENGINE_EVENT_TYPES } from "@memory-middleware/shared-types";
import { assertDomainSlug, DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type {
  CreateGlobalFactInput,
  DomainEngineStore,
  UpdateGlobalFactInput,
} from "./store.js";

export interface GlobalFactEngineDeps {
  store: DomainEngineStore;
  events: EventEmitter;
  traceId: string;
}

export async function addGlobalFact(
  deps: GlobalFactEngineDeps,
  input: CreateGlobalFactInput,
): Promise<Fact> {
  assertDomainSlug(input.key, "fact key");
  const fact = await deps.store.createGlobalFact(input);
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.GLOBAL_FACT_CREATED, {
    traceId: deps.traceId,
    workspaceId: input.workspaceId,
    extra: { factId: fact.factId, key: fact.key },
  });
  return fact;
}

export async function updateGlobalFact(
  deps: GlobalFactEngineDeps,
  factId: string,
  input: UpdateGlobalFactInput,
): Promise<Fact> {
  const fact = await deps.store.updateGlobalFact(factId, input);
  if (!fact) {
    throw new DomainEngineError(`Global fact not found: ${factId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.GLOBAL_FACT_UPDATED, {
    traceId: deps.traceId,
    workspaceId: fact.workspaceId,
    extra: { factId: fact.factId, key: fact.key },
  });
  return fact;
}

export async function archiveGlobalFact(
  deps: GlobalFactEngineDeps,
  factId: string,
): Promise<Fact> {
  const fact = await deps.store.archiveGlobalFact(factId);
  if (!fact) {
    throw new DomainEngineError(`Global fact not found: ${factId}`, "not_found");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.GLOBAL_FACT_ARCHIVED, {
    traceId: deps.traceId,
    workspaceId: fact.workspaceId,
    extra: { factId: fact.factId, key: fact.key },
  });
  return fact;
}

export async function deleteGlobalFact(
  deps: GlobalFactEngineDeps,
  factId: string,
): Promise<void> {
  const existing = await deps.store.getGlobalFact(factId);
  if (!existing) {
    throw new DomainEngineError(`Global fact not found: ${factId}`, "not_found");
  }
  const deleted = await deps.store.deleteGlobalFact(factId);
  if (!deleted) {
    throw new DomainEngineError(`Failed to delete global fact: ${factId}`, "delete_failed");
  }
  await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.GLOBAL_FACT_DELETED, {
    traceId: deps.traceId,
    workspaceId: existing.workspaceId,
    extra: { factId, key: existing.key },
  });
}
