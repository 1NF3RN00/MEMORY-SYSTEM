import type { SourceType } from "@memory-middleware/shared-types";

export interface NormalizationInput {
  sourceType: SourceType;
  rawContent: string;
  title?: string;
  sourceUrl?: string;
  useLlmStructuring?: boolean;
}

export interface NormalizationOutput {
  normalizedContent: string;
  title: string;
  summary?: string;
  traceId: string;
  strategy: string;
  usedLlm: boolean;
  steps: Array<{
    step: string;
    timestamp: string;
    latencyMs?: number;
  }>;
  transformations: Array<{
    step: string;
    inputPreview: string;
    outputPreview: string;
    timestamp: string;
  }>;
}

export interface LlmStructurer {
  structure(input: {
    markdown: string;
    title: string;
  }): Promise<{ structuredMarkdown: string; metadata?: Record<string, unknown> }>;
}
