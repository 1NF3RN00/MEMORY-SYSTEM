import { newUlid } from "@memory-middleware/shared-types";
import type { NormalizationInput, NormalizationOutput, LlmStructurer } from "./types.js";

function preview(text: string, max = 120): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function collapseWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeJson(raw: string): string {
  const parsed: unknown = JSON.parse(raw);
  return JSON.stringify(parsed, null, 2);
}

function extractTitleFromMarkdown(content: string, fallback: string): string {
  const match = /^#\s+(.+)$/m.exec(content);
  return match?.[1]?.trim() ?? fallback;
}

const noopLlmStructurer: LlmStructurer = {
  async structure({ markdown }) {
    return { structuredMarkdown: markdown };
  },
};

export async function normalizeContent(
  input: NormalizationInput,
  llmStructurer: LlmStructurer = noopLlmStructurer,
): Promise<NormalizationOutput> {
  const traceId = newUlid();
  const steps: NormalizationOutput["steps"] = [];
  const transformations: NormalizationOutput["transformations"] = [];
  const started = Date.now();

  let content = input.rawContent;
  const recordStep = (step: string) => {
    const ts = new Date().toISOString();
    steps.push({ step, timestamp: ts, latencyMs: Date.now() - started });
    return ts;
  };

  recordStep("deterministic_parse");

  if (input.sourceType === "json") {
    const before = content;
    content = normalizeJson(content);
    transformations.push({
      step: "json_pretty_print",
      inputPreview: preview(before),
      outputPreview: preview(content),
      timestamp: new Date().toISOString(),
    });
  } else {
    const before = content;
    content = collapseWhitespace(content);
    transformations.push({
      step: "whitespace_normalization",
      inputPreview: preview(before),
      outputPreview: preview(content),
      timestamp: new Date().toISOString(),
    });
  }

  recordStep("structural_extraction");

  let title =
    input.title?.trim() ||
    (input.sourceType === "markdown" || input.sourceType === "website"
      ? extractTitleFromMarkdown(content, "Untitled")
      : "Untitled");

  recordStep("schema_validation");

  let usedLlm = false;
  if (input.useLlmStructuring) {
    recordStep("optional_llm_structuring");
    const llmResult = await llmStructurer.structure({ markdown: content, title });
    const before = content;
    content = llmResult.structuredMarkdown;
    usedLlm = true;
    transformations.push({
      step: "llm_structuring",
      inputPreview: preview(before),
      outputPreview: preview(content),
      timestamp: new Date().toISOString(),
    });
  }

  recordStep("canonical_format");

  return {
    normalizedContent: content,
    title,
    traceId,
    strategy: usedLlm ? "deterministic+llm-v1" : "deterministic-v1",
    usedLlm,
    steps,
    transformations,
  };
}
