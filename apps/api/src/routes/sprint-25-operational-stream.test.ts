import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

function readSource(relativePath: string): string {
  return readFileSync(join(srcRoot, relativePath), "utf8");
}

describe("Sprint-25 — operational stream route wiring", () => {
  it("registers SSE operational-stream route with auth and hub injection", () => {
    const routes = readSource("routes/index.ts");
    const createApp = readSource("create-app.ts");
    const bootstrap = readSource("bootstrap.ts");

    assert.match(routes, /registerOperationalStreamRoutes/);
    assert.match(createApp, /operationalStreamHub/);
    assert.match(bootstrap, /createSubscribableEventEmitter/);
    assert.match(bootstrap, /createOperationalStreamHub/);
  });

  it("SSE route disables compression and uses text/event-stream", () => {
    const route = readSource("routes/operational-stream.ts");
    assert.match(route, /compress:\s*false/);
    assert.match(route, /text\/event-stream/);
    assert.match(route, /enforceWorkspaceScope/);
  });
});
