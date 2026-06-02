export interface ParsedSection {
  heading: string;
  level: number;
  content: string;
  /** Full heading hierarchy at this section */
  headingHierarchy: string[];
  /** Section path as slug segments */
  sectionPath: string[];
  /** Whether content is primarily a bullet group */
  isBulletGroup: boolean;
  startLine: number;
  endLine: number;
}

export interface ParsedDocument {
  sections: ParsedSection[];
  headingHierarchy: string[];
  parseError?: string;
}

const HEADING_RE = /^(#{1,6})\s+(.+)$/;
const BULLET_RE = /^(\s*[-*+]\s|\s*\d+\.\s)/;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function isBulletBlock(lines: string[]): boolean {
  if (lines.length === 0) return false;
  const bulletLines = lines.filter((l) => BULLET_RE.test(l.trim()));
  return bulletLines.length >= lines.length * 0.5 && bulletLines.length >= 2;
}

/**
 * Deterministic markdown structural parser.
 * Extracts heading hierarchy, sections, and bullet groups.
 */
export function parseMarkdownStructure(content: string): ParsedDocument {
  const text = content.trim();
  if (text.length === 0) {
    return { sections: [], headingHierarchy: [] };
  }

  try {
    const lines = text.split("\n");
    const sections: ParsedSection[] = [];
    const hierarchyStack: Array<{ level: number; heading: string }> = [];

    let currentHeading = "";
    let currentLevel = 0;
    let currentLines: string[] = [];
    let sectionStartLine = 0;

    const flushSection = (endLine: number) => {
      const body = currentLines.join("\n").trim();
      if (body.length === 0 && !currentHeading) return;

      const headingHierarchy = hierarchyStack.map((h) => h.heading);
      const sectionPath = hierarchyStack.map((h) => slugify(h.heading));

      sections.push({
        heading: currentHeading || "(root)",
        level: currentLevel,
        content: body,
        headingHierarchy: [...headingHierarchy],
        sectionPath: [...sectionPath],
        isBulletGroup: isBulletBlock(currentLines),
        startLine: sectionStartLine,
        endLine,
      });
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const headingMatch = line.match(HEADING_RE);

      if (headingMatch) {
        flushSection(i - 1);

        const level = headingMatch[1]?.length ?? 1;
        const heading = headingMatch[2]?.trim() ?? "";

        while (hierarchyStack.length > 0) {
          const top = hierarchyStack[hierarchyStack.length - 1];
          if (top && top.level >= level) {
            hierarchyStack.pop();
          } else {
            break;
          }
        }
        hierarchyStack.push({ level, heading });

        currentHeading = heading;
        currentLevel = level;
        currentLines = [];
        sectionStartLine = i;
      } else {
        currentLines.push(line);
      }
    }

    flushSection(lines.length - 1);

    const topLevelHeadings = [
      ...new Set(sections.filter((s) => s.level === 1).map((s) => s.heading)),
    ];

    return {
      sections,
      headingHierarchy: topLevelHeadings.length > 0 ? topLevelHeadings : sections.map((s) => s.heading),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      sections: [],
      headingHierarchy: [],
      parseError: message,
    };
  }
}

/**
 * Split oversized section content on paragraph boundaries while preserving bullet groups.
 */
export function splitSectionOnBoundaries(
  content: string,
  maxTokens: number,
  isBulletGroup: boolean,
): string[] {
  const maxChars = maxTokens * 4;
  if (content.length <= maxChars) return [content];

  if (isBulletGroup) {
    const lines = content.split("\n");
    const blocks: string[] = [];
    let current = "";

    for (const line of lines) {
      const candidate = current ? `${current}\n${line}` : line;
      if (candidate.length > maxChars && current.length > 0) {
        blocks.push(current);
        current = line;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) blocks.push(current);
    return blocks.length > 0 ? blocks : [content.slice(0, maxChars)];
  }

  const paragraphs = content.split(/\n\n+/);
  const blocks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    const candidate = current ? `${current}\n\n${para}` : para;
    if (candidate.length > maxChars && current.length > 0) {
      blocks.push(current);
      current = para;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) blocks.push(current);

  if (blocks.length === 0) {
    const result: string[] = [];
    for (let i = 0; i < content.length; i += maxChars) {
      result.push(content.slice(i, i + maxChars));
    }
    return result;
  }

  return blocks;
}
