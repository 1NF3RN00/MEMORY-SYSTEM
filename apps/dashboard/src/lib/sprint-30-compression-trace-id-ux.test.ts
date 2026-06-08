/**
 * Sprint-30 verification: compression vs retrieval trace ID UX
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildCompressionTraceIdHint,
  findCompressionTraceMatch,
  hintFromCompressionResolveError,
  validateRetrievalTraceIdForCompress,
} from "./compressionTraceId.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

describe("Sprint-30 — compression trace ID UX", () => {
  describe("objective 1: actionable error with retrievalTraceId", () => {
    it("api client preserves structured compression mismatch fields", () => {
      const source = readSrc("lib/api.ts");
      expect(source).toMatch(/export class ApiError/);
      expect(source).toMatch(/retrievalTraceId\?: string/);
      expect(source).toMatch(/compressionTraceId\?: string/);
      expect(source).toMatch(/code\?: string/);
    });

    it("hintFromCompressionResolveError maps API body to UI hint", () => {
      const hint = hintFromCompressionResolveError({
        error: "wrong id",
        code: "compression_trace_id_provided",
        suppliedTraceId: "01COMP",
        compressionTraceId: "01COMP",
        retrievalTraceId: "01RET",
      });
      expect(hint).toEqual({
        message: "wrong id",
        compressionTraceId: "01COMP",
        retrievalTraceId: "01RET",
      });
    });
  });

  describe("objective 2: client validation", () => {
    const traces = [
      {
        compressionTraceId: "01JSPRINT30COMPRESSIONTRACE001",
        retrievalTraceId: "01JSPRINT30RETRIEVALTRACE00001",
      },
    ];

    it("detects compression trace IDs in the loaded trace list", () => {
      expect(findCompressionTraceMatch("01JSPRINT30COMPRESSIONTRACE001", traces)).toEqual(traces[0]);
      expect(findCompressionTraceMatch("01JSPRINT30RETRIEVALTRACE00001", traces)).toBeNull();
    });

    it("validateRetrievalTraceIdForCompress returns hint for compression IDs", () => {
      const hint = validateRetrievalTraceIdForCompress("01JSPRINT30COMPRESSIONTRACE001", traces);
      expect(hint?.retrievalTraceId).toBe("01JSPRINT30RETRIEVALTRACE00001");
      expect(hint?.compressionTraceId).toBe("01JSPRINT30COMPRESSIONTRACE001");
    });

    it("buildCompressionTraceIdHint explains the mismatch", () => {
      const hint = buildCompressionTraceIdHint(traces[0]!);
      expect(hint.message).toMatch(/compression trace/i);
      expect(hint.retrievalTraceId).toBe(traces[0]!.retrievalTraceId);
    });
  });

  describe("objective 3: UI hints", () => {
    it("CompressionTracesPage shows inline hint and blocks client-side mismatch", () => {
      const source = readSrc("pages/CompressionTracesPage.tsx");
      expect(source).toMatch(/validateRetrievalTraceIdForCompress/);
      expect(source).toMatch(/traceIdHint/);
      expect(source).toMatch(/View compression result/);
      expect(source).toMatch(/Retrieval traces come from POST \/retrieve/);
      expect(source).toMatch(/clientHint/);
    });

    it("CompressionTracesPage still loads valid compression trace detail URLs", () => {
      const source = readSrc("pages/CompressionTracesPage.tsx");
      expect(source).toMatch(/apiGet<TraceDetail>\(`\/compression\/\$\{traceId\}`\)/);
      expect(source).toMatch(/navigate\(`\/compression-traces\/\$\{result\.compressionTraceId\}`\)/);
    });
  });
});
