import {
  DEFAULT_CHUNK_CONFIG,
  DETERMINISTIC_FALLBACK_STRATEGY,
  STRUCTURAL_CHUNKING_STRATEGY,
  type CanonicalMemoryChunk,
  type StructuralChunkResult,
  type StructuralSegmentationReason,
} from "@memory-middleware/shared-types";
import { newUlid } from "@memory-middleware/shared-types";
import {
  assignSemanticGroups,
  generateAdjacency,
  type ChunkWithLineage,
} from "./adjacency.js";
import { averageDensityScore, computeSemanticDensity } from "./density.js";
import {
  parseMarkdownStructure,
  splitSectionOnBoundaries,
  type ParsedSection,
} from "./parser.js";
import { estimateTokens } from "./token-estimator.js";
import { buildChunkRetrievalSurface } from "./semantic-enrichment.js";

export interface StructureAwareChunkInput {
  memoryId: string;
  normalizedContent: string;
  sourceType: string;
  maxTokens?: number;
}

function buildBoundaryReason(section: ParsedSection, splitIndex: number, totalSplits: number): string {
  if (totalSplits === 1) {
    if (section.isBulletGroup) return "preserved bullet group as semantic block";
    if (section.heading !== "(root)") return `section boundary at heading "${section.heading}"`;
    return "root content block";
  }
  return `section "${section.heading}" split at semantic boundary ${splitIndex + 1}/${totalSplits}`;
}

function sectionsToRawChunks(
  sections: ParsedSection[],
  maxTokens: number,
): Array<{
  content: string;
  lineage: ChunkWithLineage["lineage"];
  segmentationReason: Omit<StructuralSegmentationReason, "chunkIndex">;
}> {
  const raw: Array<{
    content: string;
    lineage: ChunkWithLineage["lineage"];
    segmentationReason: Omit<StructuralSegmentationReason, "chunkIndex">;
  }> = [];

  for (const section of sections) {
    const body = section.content.trim();
    if (body.length === 0 && section.heading === "(root)") continue;

    const fullContent =
      section.heading !== "(root)" && body.length > 0
        ? `# ${section.heading}\n\n${body}`
        : body || `# ${section.heading}`;

    const splits = splitSectionOnBoundaries(fullContent, maxTokens, section.isBulletGroup);

    for (let si = 0; si < splits.length; si++) {
      const content = splits[si] ?? "";
      raw.push({
        content,
        lineage: {
          sectionPath: section.sectionPath,
          headingHierarchy: section.headingHierarchy,
        },
        segmentationReason: {
          strategy: STRUCTURAL_CHUNKING_STRATEGY,
          headingInheritance: section.headingHierarchy,
          boundaryReason: buildBoundaryReason(section, si, splits.length),
          preservedBulletGroup: section.isBulletGroup && splits.length === 1,
        },
      });
    }
  }

  return raw;
}

function fallbackChunk(
  input: StructureAwareChunkInput,
  reason: string,
  started: number,
): StructuralChunkResult {
  const maxTokens = input.maxTokens ?? DEFAULT_CHUNK_CONFIG.maxTokens;
  const maxChars = maxTokens * 4;
  const overlapChars = DEFAULT_CHUNK_CONFIG.overlapTokens * 4;
  const step = Math.max(1, maxChars - overlapChars);
  const text = input.normalizedContent.trim();

  const rawChunks: Array<{
    content: string;
    tokenCount: number;
    lineage: ChunkWithLineage["lineage"];
    segmentationReason: StructuralSegmentationReason;
  }> = [];

  let offset = 0;
  let index = 0;
  while (offset < text.length) {
    const end = Math.min(offset + maxChars, text.length);
    const content = text.slice(offset, end);
    rawChunks.push({
      content,
      tokenCount: estimateTokens(content),
      lineage: { sectionPath: [], headingHierarchy: [] },
      segmentationReason: {
        chunkIndex: index,
        strategy: DETERMINISTIC_FALLBACK_STRATEGY,
        headingInheritance: [],
        boundaryReason: `deterministic fallback: ${reason}`,
        preservedBulletGroup: false,
      },
    });
    if (end >= text.length) break;
    offset += step;
    index++;
  }

  const allContents = rawChunks.map((r) => r.content);
  const withDensity = rawChunks.map((r, i) => {
    const siblings = allContents.filter((_, j) => j !== i);
    const densityDetail = computeSemanticDensity(r.content, siblings);
    const chunkId = newUlid();
    return { ...r, chunkId, densityDetail, semanticDensityScore: densityDetail.combinedScore };
  });

  return {
    chunks: withDensity.map((r, i) => ({
      chunkId: r.chunkId,
      content: r.content,
      tokenCount: r.tokenCount,
      lineage: r.lineage,
      segmentationReason: { ...r.segmentationReason, chunkIndex: i },
      semanticDensityScore: r.semanticDensityScore,
      densityDetail: r.densityDetail,
    })),
    strategy: DETERMINISTIC_FALLBACK_STRATEGY,
    fallbackUsed: true,
    fallbackReason: reason,
    segmentationReasons: withDensity.map((r) => r.segmentationReason),
    structureParseLatencyMs: Date.now() - started,
  };
}

/**
 * Structure-aware deterministic chunking with graceful fallback.
 * Applies heading-aware segmentation for markdown; falls back for other source types or parse failures.
 */
export function structureAwareChunk(input: StructureAwareChunkInput): StructuralChunkResult {
  const started = Date.now();
  const maxTokens = input.maxTokens ?? DEFAULT_CHUNK_CONFIG.maxTokens;

  const isMarkdownLike =
    input.sourceType === "markdown" ||
    input.sourceType === "website" ||
    /^#{1,6}\s/m.test(input.normalizedContent);

  if (!isMarkdownLike) {
    return fallbackChunk(input, "non-markdown source type", started);
  }

  const parsed = parseMarkdownStructure(input.normalizedContent);

  if (parsed.parseError) {
    return fallbackChunk(input, parsed.parseError, started);
  }

  if (parsed.sections.length === 0) {
    return fallbackChunk(input, "no structural sections detected", started);
  }

  const raw = sectionsToRawChunks(parsed.sections, maxTokens);

  if (raw.length === 0) {
    return fallbackChunk(input, "empty structural segmentation", started);
  }

  const provisional: ChunkWithLineage[] = raw.map((r, index) => ({
    id: newUlid(),
    chunkIndex: index,
    content: r.content,
    tokenCount: estimateTokens(r.content),
    lineage: r.lineage,
    segmentationReason: {
      ...r.segmentationReason,
      chunkIndex: index,
    },
  }));

  const withGroups = assignSemanticGroups(provisional);
  const withAdjacency = generateAdjacency(withGroups);

  const allContents = withAdjacency.map((c) => c.content);
  const chunks = withAdjacency.map((chunk, i) => {
    const siblings = allContents.filter((_, j) => j !== i);
    const densityDetail = computeSemanticDensity(chunk.content, siblings);
    const heading =
      chunk.lineage.headingHierarchy[chunk.lineage.headingHierarchy.length - 1];

    return {
      chunkId: chunk.id,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      lineage: chunk.lineage,
      segmentationReason: chunk.segmentationReason,
      semanticDensityScore: densityDetail.combinedScore,
      densityDetail,
    };
  });

  return {
    chunks,
    strategy: STRUCTURAL_CHUNKING_STRATEGY,
    fallbackUsed: false,
    segmentationReasons: chunks.map((c) => c.segmentationReason),
    structureParseLatencyMs: Date.now() - started,
  };
}

/** Convert structural result to canonical memory chunks. */
export function toCanonicalChunks(
  memoryId: string,
  result: StructuralChunkResult,
  options?: { tags?: string[]; memoryType?: string },
): CanonicalMemoryChunk[] {
  const now = new Date().toISOString();

  return result.chunks.map((chunk, index) => {
    const heading =
      chunk.lineage.headingHierarchy[chunk.lineage.headingHierarchy.length - 1];

    const retrievalSurface = buildChunkRetrievalSurface({
      content: chunk.content,
      lineage: chunk.lineage,
      ...(options?.tags ? { tags: options.tags } : {}),
      ...(options?.memoryType ? { memoryType: options.memoryType } : {}),
    });

    return {
      id: chunk.chunkId,
      memoryId,
      chunkIndex: index,
      content: chunk.content,
      tokenCount: chunk.tokenCount,
      embeddingStatus: "pending" as const,
      semanticDensityScore: chunk.semanticDensityScore,
      metadata: {
        chunkingStrategy: result.strategy,
        ...(heading ? { heading } : {}),
        lineage: chunk.lineage,
        segmentationReason: chunk.segmentationReason,
        densityDetail: chunk.densityDetail,
        semanticSurface: retrievalSurface.semanticSurface,
        retrievalSurface,
        ...(index > 0 && result.fallbackUsed ? { overlapPrevious: true } : {}),
        ...(index < result.chunks.length - 1 && result.fallbackUsed
          ? { overlapNext: true }
          : {}),
      },
      observability: { retrievalCount: 0 },
      createdAt: now,
    };
  });
}

export { averageDensityScore };
