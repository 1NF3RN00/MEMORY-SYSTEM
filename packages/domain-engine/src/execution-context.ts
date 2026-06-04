import type { EventEmitter } from "@memory-middleware/observability";
import type { DomainExecutionContext } from "@memory-middleware/shared-types";
import {
  DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
  DOMAIN_ENGINE_EVENT_TYPES,
} from "@memory-middleware/shared-types";
import { DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type { DomainEngineStore } from "./store.js";

export interface ResolveExecutionContextInput {
  workspaceId: string;
  domainKey?: string;
  domainAction?: string;
}

export interface ResolveExecutionContextDeps {
  store: DomainEngineStore;
  events?: EventEmitter;
  traceId?: string;
}

export async function resolveDomainExecutionContext(
  deps: ResolveExecutionContextDeps,
  input: ResolveExecutionContextInput,
): Promise<DomainExecutionContext> {
  const loaded = await deps.store.loadExecutionContextData(
    input.workspaceId,
    input.domainKey,
    input.domainAction,
  );

  if (input.domainKey && !loaded.domain) {
    throw new DomainEngineError(
      `Domain not found for key: ${input.domainKey}`,
      "domain_not_found",
    );
  }

  if (input.domainKey && input.domainAction && loaded.instructions.length === 0) {
    const allForDomain = loaded.domain
      ? await deps.store.listInstructions(loaded.domain.domainId)
      : [];
    const availableActions = [
      ...new Set(
        allForDomain.filter((i) => i.isActive && i.status === "active").map((i) => i.actionKey),
      ),
    ];
    throw new DomainEngineError(
      `No active instruction for action: ${input.domainAction}`,
      "instruction_not_found",
      { availableActions },
    );
  }

  const domain = loaded.domain;
  const context: DomainExecutionContext = {
    workspaceId: input.workspaceId,
    globalFacts: loaded.globalFacts,
    domainFacts: loaded.domainFacts,
    instructions: loaded.instructions,
    retrievalRules: domain?.retrievalRules ?? [],
    metadataFilters: domain?.metadataFilters ?? [],
    relationshipConstraints:
      domain?.relationshipConstraints ?? DEFAULT_RELATIONSHIP_NEIGHBORHOOD_CONSTRAINT,
    resolvedAt: new Date().toISOString(),
  };

  if (domain) {
    context.domainId = domain.domainId;
    context.domainKey = domain.domainKey;
  }
  if (input.domainAction) {
    context.domainAction = input.domainAction;
  }

  if (deps.events && deps.traceId) {
    await emitDomainEngineEvent(deps.events, DOMAIN_ENGINE_EVENT_TYPES.EXECUTION_CONTEXT_RESOLVED, {
      traceId: deps.traceId,
      workspaceId: input.workspaceId,
      extra: {
        domainKey: context.domainKey,
        domainAction: context.domainAction,
        globalFactCount: context.globalFacts.length,
        domainFactCount: context.domainFacts.length,
      },
    });
  }

  return context;
}
