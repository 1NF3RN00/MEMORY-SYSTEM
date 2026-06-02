import type { SourceType } from "@memory-middleware/shared-types";

export type FileSourceType = Exclude<SourceType, "website">;

export interface DetectedFile {
  relativePath: string;
  fileName: string;
  detectedType: FileSourceType | null;
  matchesSelectedType: boolean;
  processable: boolean;
  ingestType?: FileSourceType;
  reason?: string;
  suggestedType?: FileSourceType;
}

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown", ".mdown", ".mkd"]);
const TEXT_EXTENSIONS = new Set([".txt", ".text", ".log", ".notes"]);
const JSON_EXTENSIONS = new Set([".json", ".jsonl"]);

const UNSUPPORTED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".mp3",
  ".mp4",
  ".wav",
  ".zip",
  ".tar",
  ".gz",
  ".html",
  ".htm",
  ".xml",
  ".yaml",
  ".yml",
]);

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function looksLikeBinary(content: string): boolean {
  if (content.includes("\0")) return true;
  const sample = content.slice(0, 4096);
  let nonPrintable = 0;
  for (let i = 0; i < sample.length; i++) {
    const code = sample.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13) continue;
    if (code < 32 || code === 127) nonPrintable++;
  }
  return nonPrintable / Math.max(sample.length, 1) > 0.05;
}

function isValidJson(content: string): boolean {
  try {
    JSON.parse(content);
    return true;
  } catch {
    return false;
  }
}

function looksLikeMarkdown(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return false;
  return (
    /^#{1,6}\s/m.test(trimmed) ||
    /^[-*+]\s/m.test(trimmed) ||
    /^\d+\.\s/m.test(trimmed) ||
    /```/.test(trimmed) ||
    /\[.+?\]\(.+?\)/.test(trimmed)
  );
}

export function detectFileSourceType(fileName: string, content: string): FileSourceType | null {
  if (!content.trim()) return null;
  if (looksLikeBinary(content)) return null;

  const ext = extensionOf(fileName);

  if (JSON_EXTENSIONS.has(ext)) {
    return isValidJson(content) ? "json" : null;
  }

  if (MARKDOWN_EXTENSIONS.has(ext)) {
    return "markdown";
  }

  if (TEXT_EXTENSIONS.has(ext)) {
    return looksLikeMarkdown(content) ? "markdown" : "text";
  }

  if (UNSUPPORTED_EXTENSIONS.has(ext)) {
    return null;
  }

  if (isValidJson(content.trim())) return "json";
  if (looksLikeMarkdown(content)) return "markdown";
  if (ext === "" || ext === ".md") return looksLikeMarkdown(content) ? "markdown" : "text";

  return "text";
}

export type FolderClassificationMode = "strict" | "auto-detect";

export interface ClassifyFolderFileInput {
  relativePath: string;
  content: string;
  selectedSourceType: FileSourceType;
  mode?: FolderClassificationMode;
}

export function classifyFolderFile(input: ClassifyFolderFileInput): DetectedFile {
  const fileName = input.relativePath.split(/[/\\]/).pop() ?? input.relativePath;
  const ext = extensionOf(fileName);
  const detectedType = detectFileSourceType(fileName, input.content);
  const mode = input.mode ?? "strict";

  if (!input.content.trim()) {
    return {
      relativePath: input.relativePath,
      fileName,
      detectedType: null,
      matchesSelectedType: false,
      processable: false,
      reason: "File is empty",
    };
  }

  if (looksLikeBinary(input.content)) {
    return {
      relativePath: input.relativePath,
      fileName,
      detectedType: null,
      matchesSelectedType: false,
      processable: false,
      reason: "Binary or non-text content",
    };
  }

  if (UNSUPPORTED_EXTENSIONS.has(ext)) {
    const result: DetectedFile = {
      relativePath: input.relativePath,
      fileName,
      detectedType: null,
      matchesSelectedType: false,
      processable: false,
      reason: `Unsupported format (${ext || "unknown"})`,
    };
    if (ext === ".html" || ext === ".htm") result.suggestedType = "markdown";
    return result;
  }

  if (!detectedType) {
    return {
      relativePath: input.relativePath,
      fileName,
      detectedType: null,
      matchesSelectedType: false,
      processable: false,
      reason: ext === ".json" ? "Invalid JSON" : "Could not detect a supported text format",
    };
  }

  const matchesSelectedType = detectedType === input.selectedSourceType;
  const processable =
    mode === "auto-detect" ? true : matchesSelectedType;
  const ingestType =
    mode === "auto-detect"
      ? detectedType
      : matchesSelectedType
        ? input.selectedSourceType
        : undefined;

  const result: DetectedFile = {
    relativePath: input.relativePath,
    fileName,
    detectedType,
    matchesSelectedType,
    processable,
  };

  if (ingestType) result.ingestType = ingestType;

  if (!processable) {
    result.reason = `Detected as ${detectedType}, expected ${input.selectedSourceType}`;
    result.suggestedType = detectedType;
  }

  return result;
}

export interface ReformatGuidance {
  fromLabel: string;
  targetType: FileSourceType;
  steps: string[];
}

export function reformatGuidanceForFile(
  file: DetectedFile,
  targetType: FileSourceType,
): ReformatGuidance | null {
  if (file.processable || !file.reason) return null;

  const guidanceTarget = file.suggestedType ?? targetType;
  const ext = extensionOf(file.fileName);
  const fromLabel = ext ? ext.slice(1).toUpperCase() : "unknown";

  if (ext === ".html" || ext === ".htm") {
    return {
      fromLabel: "HTML",
      targetType: guidanceTarget,
      steps: [
        "Extract main content — strip nav, footer, and boilerplate.",
        "Convert headings to markdown (#, ##, ###).",
        "Preserve lists and code blocks as markdown structure.",
        "Save as .md before re-importing with source type Markdown.",
      ],
    };
  }

  if (ext === ".json" || file.detectedType === "json") {
    return {
      fromLabel: "JSON",
      targetType: guidanceTarget,
      steps:
        guidanceTarget === "json"
          ? ["Validate with a JSON linter.", "Ensure the root is an object or array.", "Remove trailing commas and comments."]
          : [
              "For plain text: export human-readable summaries or notes from the JSON.",
              "For markdown: document structure with headings and bullet lists derived from keys.",
            ],
    };
  }

  if (file.detectedType === "markdown" && guidanceTarget === "text") {
    return {
      fromLabel: "Markdown",
      targetType: "text",
      steps: [
        "Strip markdown syntax (# headings, **bold**, links).",
        "Keep paragraph breaks for chunking boundaries.",
        "Save as .txt and re-import with source type Plain text.",
      ],
    };
  }

  if (file.detectedType === "text" && guidanceTarget === "markdown") {
    return {
      fromLabel: "Plain text",
      targetType: "markdown",
      steps: [
        "Add a top-level # title.",
        "Group related paragraphs under ## sections.",
        "Use bullet lists for enumerations.",
        "Save as .md and re-import with source type Markdown.",
      ],
    };
  }

  if (UNSUPPORTED_EXTENSIONS.has(ext)) {
    return {
      fromLabel,
      targetType: guidanceTarget,
      steps: [
        `Convert ${fromLabel} to a supported Sprint 1 format (markdown, plain text, or JSON).`,
        "Run through deterministic normalization — no raw binary or document blobs.",
        `Re-import with source type ${guidanceTarget}.`,
      ],
    };
  }

  return {
    fromLabel: file.detectedType ?? fromLabel,
    targetType: guidanceTarget,
    steps: [
      `Align content with the ${guidanceTarget} canonical format.`,
      "Ensure UTF-8 encoding and non-empty body text.",
      `Re-import with source type ${guidanceTarget}.`,
    ],
  };
}
