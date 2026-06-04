import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOperationalObject } from "./operational-objects.js";
import { DomainEngineError } from "./errors.js";
import type { DomainEngineStore } from "./store.js";

function mockStore(): DomainEngineStore {
  return {
    createOperationalObject: async (input) => ({
      objectId: "01OBJ",
      workspaceId: input.workspaceId,
      objectType: input.objectType,
      name: input.name,
      status: input.status,
      metadata: input.metadata ?? {},
      objectStatus: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }),
  } as unknown as DomainEngineStore;
}

describe("createOperationalObject", () => {
  it("rejects invalid objectType slugs", async () => {
    await assert.rejects(
      () =>
        createOperationalObject(
          { store: mockStore(), events: { emit: async () => {} }, traceId: "trace" },
          {
            workspaceId: "ws1",
            objectType: "Customer",
            name: "Acme",
            status: "client",
          },
        ),
      DomainEngineError,
    );
  });

  it("creates object and emits event", async () => {
    let emitted = false;
    const object = await createOperationalObject(
      {
        store: mockStore(),
        events: {
          emit: async () => {
            emitted = true;
          },
        },
        traceId: "trace",
      },
      {
        workspaceId: "ws1",
        objectType: "customer",
        name: "Acme HVAC",
        status: "client",
        metadata: { region: "CT" },
      },
    );
    assert.equal(object.objectType, "customer");
    assert.equal(emitted, true);
  });
});
