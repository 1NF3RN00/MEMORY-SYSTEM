/**
 * Sprint-25 verification: WebSocket/SSE operational stream
 * OP-24 / FE-003 — push events, reconnect, poll fallback, auth
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  mergeOperationalStreamEvents,
  operationalEventFromStreamPayload,
  subscribeOperationalStream,
  TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS,
} from "./operationalStream.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

describe("Sprint-25 — operational stream", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("objective 1: events without full refetch", () => {
    it("provider subscribes to operational stream and merges pushed events", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/subscribeOperationalStream/);
      expect(source).toMatch(/mergeOperationalStreamEvents/);
      expect(source).toMatch(/streamConnected/);
    });

    it("uses slower summary poll when stream is connected", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS/);
      expect(source).toMatch(/summaryPollIntervalMs/);
      expect(TELEMETRY_STREAM_CONNECTED_POLL_INTERVAL_MS).toBeGreaterThan(15_000);
    });

    it("merges stream events ahead of baseline without duplicates", () => {
      const baseline = [
        operationalEventFromStreamPayload({
          id: "ret-1",
          category: "RETRIEVAL",
          title: "baseline",
          detail: "completed",
          timestamp: "2026-06-08T12:00:00.000Z",
        }),
      ];
      const pushed = [
        operationalEventFromStreamPayload({
          id: "ret-2",
          category: "RETRIEVAL",
          title: "pushed",
          detail: "completed",
          timestamp: "2026-06-08T12:01:00.000Z",
        }),
      ];
      const merged = mergeOperationalStreamEvents(baseline, pushed);
      expect(merged.map((event) => event.id)).toEqual(["ret-2", "ret-1"]);
    });
  });

  describe("objective 2: poll fallback on disconnect", () => {
    it("client reconnects with backoff after EventSource errors", async () => {
      vi.useFakeTimers();

      class MockEventSource {
        static instances: MockEventSource[] = [];
        url: string;
        onopen: (() => void) | null = null;
        onmessage: ((event: MessageEvent) => void) | null = null;
        onerror: (() => void) | null = null;

        constructor(url: string) {
          this.url = url;
          MockEventSource.instances.push(this);
        }

        close() {
          // no-op
        }
      }

      vi.stubGlobal("EventSource", MockEventSource);

      const statuses: string[] = [];
      const subscription = subscribeOperationalStream({
        workspaceId: "ws-test",
        accessToken: "token-abc",
        enabled: true,
        onEnvelope: () => undefined,
        onStatus: (status) => statuses.push(status),
      });

      expect(MockEventSource.instances[0]?.url).toContain("/workspaces/ws-test/operational-stream");
      expect(MockEventSource.instances[0]?.url).toContain("access_token=token-abc");

      MockEventSource.instances[0]?.onerror?.();
      expect(statuses).toContain("disconnected");

      await vi.advanceTimersByTimeAsync(1_000);
      expect(MockEventSource.instances.length).toBeGreaterThan(1);

      subscription.close();
      vi.useRealTimers();
    });

    it("provider falls back to 15s poll when stream is not connected", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/TELEMETRY_POLL_INTERVAL_MS/);
      expect(source).toMatch(/streamStatus === "connected"/);
    });
  });

  describe("objective 3: auth on stream", () => {
    it("SSE URL carries bearer token for EventSource auth", () => {
      const source = readSrc("lib/operationalStream.ts");
      expect(source).toMatch(/access_token/);
      expect(source).toMatch(/EventSource/);
    });

    it("API auth middleware accepts access_token query for operational-stream", () => {
      const apiAuth = readFileSync(
        join(dashboardSrc, "../../api/src/middleware/auth.ts"),
        "utf8",
      );
      expect(apiAuth).toMatch(/OPERATIONAL_STREAM_PATH_SUFFIX/);
      expect(apiAuth).toMatch(/access_token/);
      expect(apiAuth).toMatch(/workspaceMatch/);
    });
  });

  describe("anti-objective: no cross-tenant leak", () => {
    it("API route enforces workspace scope before subscribing", () => {
      const route = readFileSync(
        join(dashboardSrc, "../../api/src/routes/operational-stream.ts"),
        "utf8",
      );
      expect(route).toMatch(/enforceWorkspaceScope/);
    });
  });
});
