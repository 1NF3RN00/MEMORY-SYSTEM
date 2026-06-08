import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  COMPRESSION_PICKER_LIST_FIELDS,
  RETRIEVAL_PICKER_LIST_FIELDS,
  TELEMETRY_COMPRESSION_LIST_FIELDS,
  TELEMETRY_CONTEXT_RENDER_LIST_FIELDS,
} from "./listFieldProjection.js";

const dashboardSrc = dirname(fileURLToPath(import.meta.url));

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

describe("sprint-22 list field projection", () => {
  it("telemetry analytics uses projected compression and context list fields", () => {
    const source = readSrc("workspaceTelemetry.ts");
    expect(source).toContain("TELEMETRY_COMPRESSION_LIST_FIELDS");
    expect(source).toContain("TELEMETRY_CONTEXT_RENDER_LIST_FIELDS");
    expect(source).toContain(
      `&fields=\${TELEMETRY_COMPRESSION_LIST_FIELDS}`,
    );
    expect(source).toContain(
      `&fields=\${TELEMETRY_CONTEXT_RENDER_LIST_FIELDS}`,
    );
  });

  it("trace picker pages request only required retrieval/compression fields", () => {
    expect(readSrc("../pages/RetrievalDiagnosticsPage.tsx")).toContain(
      "fields=retrievalTraceId,query,status",
    );
    expect(readSrc("../pages/CompressionTracesPage.tsx")).toContain(
      `fields=${RETRIEVAL_PICKER_LIST_FIELDS}`,
    );
    expect(readSrc("../pages/ContextDeliveryPage.tsx")).toContain(
      `fields=${RETRIEVAL_PICKER_LIST_FIELDS}`,
    );
    expect(readSrc("../pages/ContextDeliveryPage.tsx")).toContain(
      `fields=${COMPRESSION_PICKER_LIST_FIELDS}`,
    );
  });

  it("full list pages without projection still use default list URLs", () => {
    const retrievalTraces = readSrc("../pages/RetrievalTracesPage.tsx");
    expect(retrievalTraces).toContain('"/retrieval?limit=50"');
    expect(retrievalTraces).not.toContain("fields=");

    const memoryExplorer = readSrc("../pages/MemoryExplorerPage.tsx");
    expect(memoryExplorer).toContain("/memory?workspaceId=${workspaceId}&limit=50");
    expect(memoryExplorer).not.toContain("fields=");
  });
});
