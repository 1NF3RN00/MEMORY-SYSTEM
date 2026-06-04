import type { EventEmitter } from "@memory-middleware/observability";
import type {
  OperationalObject,
  ListOperationalObjectsResult,
} from "@memory-middleware/shared-types";
import { OPERATIONAL_OBJECT_EVENT_TYPES } from "@memory-middleware/shared-types";
import { assertDomainSlug, DomainEngineError } from "./errors.js";
import { emitDomainEngineEvent } from "./events.js";
import type {
  CreateOperationalObjectInput,
  DomainEngineStore,
  ListOperationalObjectsQuery,
  UpdateOperationalObjectInput,
} from "./store.js";

export interface OperationalObjectEngineDeps {
  store: DomainEngineStore;
  events: EventEmitter;
  traceId: string;
}

export async function createOperationalObject(
  deps: OperationalObjectEngineDeps,
  input: CreateOperationalObjectInput,
): Promise<OperationalObject> {
  assertDomainSlug(input.objectType, "objectType");
  if (!input.name.trim()) {
    throw new DomainEngineError("name is required", "validation");
  }
  if (!input.status.trim()) {
    throw new DomainEngineError("status is required", "validation");
  }
  const object = await deps.store.createOperationalObject(input);
  await emitDomainEngineEvent(
    deps.events,
    OPERATIONAL_OBJECT_EVENT_TYPES.OPERATIONAL_OBJECT_CREATED,
    {
      traceId: deps.traceId,
      workspaceId: input.workspaceId,
      extra: {
        objectId: object.objectId,
        objectType: object.objectType,
        status: object.status,
      },
    },
  );
  return object;
}

export async function updateOperationalObject(
  deps: OperationalObjectEngineDeps,
  objectId: string,
  input: UpdateOperationalObjectInput,
): Promise<OperationalObject> {
  const object = await deps.store.updateOperationalObject(objectId, input);
  if (!object) {
    throw new DomainEngineError(`Operational object not found: ${objectId}`, "not_found");
  }
  await emitDomainEngineEvent(
    deps.events,
    OPERATIONAL_OBJECT_EVENT_TYPES.OPERATIONAL_OBJECT_UPDATED,
    {
      traceId: deps.traceId,
      workspaceId: object.workspaceId,
      extra: {
        objectId: object.objectId,
        objectType: object.objectType,
        status: object.status,
      },
    },
  );
  return object;
}

export async function archiveOperationalObject(
  deps: OperationalObjectEngineDeps,
  objectId: string,
): Promise<OperationalObject> {
  const object = await deps.store.archiveOperationalObject(objectId);
  if (!object) {
    throw new DomainEngineError(`Operational object not found: ${objectId}`, "not_found");
  }
  await emitDomainEngineEvent(
    deps.events,
    OPERATIONAL_OBJECT_EVENT_TYPES.OPERATIONAL_OBJECT_ARCHIVED,
    {
      traceId: deps.traceId,
      workspaceId: object.workspaceId,
      extra: {
        objectId: object.objectId,
        objectType: object.objectType,
      },
    },
  );
  return object;
}

export async function deleteOperationalObject(
  deps: OperationalObjectEngineDeps,
  objectId: string,
): Promise<void> {
  const existing = await deps.store.getOperationalObject(objectId);
  if (!existing) {
    throw new DomainEngineError(`Operational object not found: ${objectId}`, "not_found");
  }
  const deleted = await deps.store.deleteOperationalObject(objectId);
  if (!deleted) {
    throw new DomainEngineError(`Failed to delete operational object: ${objectId}`, "delete_failed");
  }
  await emitDomainEngineEvent(
    deps.events,
    OPERATIONAL_OBJECT_EVENT_TYPES.OPERATIONAL_OBJECT_DELETED,
    {
      traceId: deps.traceId,
      workspaceId: existing.workspaceId,
      extra: {
        objectId,
        objectType: existing.objectType,
      },
    },
  );
}

export async function listOperationalObjects(
  deps: OperationalObjectEngineDeps,
  query: ListOperationalObjectsQuery,
): Promise<ListOperationalObjectsResult> {
  if (query.objectType) {
    assertDomainSlug(query.objectType, "objectType");
  }
  return deps.store.listOperationalObjects(query);
}
