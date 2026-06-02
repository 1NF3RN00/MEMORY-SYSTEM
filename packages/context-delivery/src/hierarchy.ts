import type {
  DeliveryMode,
  HierarchyFormattingDecision,
  RenderedSection,
} from "@memory-middleware/shared-types";
import { getDeliveryModeProfile } from "./config.js";
import type { ContextGroup } from "./grouping.js";

function headingPrefix(level: 1 | 2 | 3): string {
  return "#".repeat(level);
}

function extractBulletLines(content: string): string[] {
  return content
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const stripped = line.replace(/^[-*•]\s+/, "").replace(/^\d+\.\s+/, "");
      return stripped.trim();
    })
    .filter((line) => line.length > 0);
}

function dedupeLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const key = line.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(line);
  }
  return result;
}

function formatBullets(lines: string[], compact: boolean): string {
  if (lines.length === 0) return "";
  const prefix = compact ? "- " : "- ";
  return lines.map((line) => `${prefix}${line}`).join("\n");
}

export function formatHierarchy(
  groups: ContextGroup[],
  mode: DeliveryMode,
): { sections: RenderedSection[]; decision: HierarchyFormattingDecision } {
  const profile = getDeliveryModeProfile(mode);
  const preservedHeadings: string[] = [];
  let bulletGroups = 0;
  let hierarchyDepth: 1 | 2 | 3 = profile.headingLevel;

  const sections: RenderedSection[] = [];

  for (const group of groups) {
    const groupHeading = `${headingPrefix(profile.headingLevel)} ${group.groupLabel}`;
    preservedHeadings.push(group.groupLabel);
    const sectionLines: string[] = [groupHeading, ""];

    for (const memory of group.memories) {
      if (group.memories.length > 1 || profile.includeSummaries) {
        const subHeading = `${headingPrefix(Math.min(3, profile.headingLevel + 1) as 1 | 2 | 3)} ${memory.title}`;
        preservedHeadings.push(memory.title);
        hierarchyDepth = Math.min(3, profile.headingLevel + 1) as 1 | 2 | 3;
        sectionLines.push(subHeading);
      }

      if (profile.includeSummaries && memory.summary) {
        sectionLines.push(memory.summary);
        sectionLines.push("");
      }

      let bullets: string[] = [];
      for (const chunk of memory.chunks) {
        bullets.push(...extractBulletLines(chunk.content));
      }

      if (profile.dedupeLines) {
        bullets = dedupeLines(bullets);
      }

      if (profile.maxBulletsPerSection !== null) {
        bullets = bullets.slice(0, profile.maxBulletsPerSection);
      }

      if (bullets.length > 0) {
        bulletGroups += 1;
        sectionLines.push(formatBullets(bullets, profile.compactBullets));
        sectionLines.push("");
      }
    }

    sections.push({
      title: group.groupLabel,
      content: sectionLines.join("\n").trim(),
      sourceMemoryIds: group.memories.map((m) => m.memoryId),
    });
  }

  return {
    sections,
    decision: {
      preservedHeadings,
      bulletGroups,
      hierarchyDepth,
    },
  };
}
