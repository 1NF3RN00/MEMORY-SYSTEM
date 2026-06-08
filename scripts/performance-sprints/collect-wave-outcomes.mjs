#!/usr/bin/env node
/**
 * Aggregate outcomes.md files for a wave into markdown + JSON summary.
 *
 * Usage:
 *   node scripts/performance-sprints/collect-wave-outcomes.mjs --wave 1
 *   node scripts/performance-sprints/collect-wave-outcomes.mjs --wave 1 --json
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { REPO_ROOT } from "./load-env.mjs";
import { getWaveSprints, loadWaves } from "./load-waves.mjs";

const SPRINTS_ROOT = path.join(REPO_ROOT, "docs/performance-improvments");

function findSprintDir(sprintNum) {
  const prefix = `sprint-${sprintNum}-`;
  const entries = fs.readdirSync(SPRINTS_ROOT, { withFileTypes: true });
  const match = entries.find((e) => e.isDirectory() && e.name.startsWith(prefix));
  if (!match) return null;
  return { dir: path.join(SPRINTS_ROOT, match.name), folder: match.name };
}

function parseTableSection(text, heading) {
  const section = text.split(`## ${heading}`)[1]?.split(/^## /m)[0];
  if (!section) return [];
  const rows = [];
  for (const line of section.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/);
    if (!m) continue;
    const [a, b, c, d] = [m[1], m[2], m[3], m[4]].map((v) => v.trim());
    if (a.includes("---") || /^metric$/i.test(a) || /^dimension$/i.test(a) || /^#$/i.test(a)) {
      continue;
    }
    rows.push({ col1: a, col2: b, col3: c, col4: d });
  }
  return rows;
}

function parseNumberedList(text, heading) {
  const section = text.split(`## ${heading}`)[1]?.split(/^## /m)[0];
  if (!section) return [];
  return section
    .split("\n")
    .map((line) => line.match(/^\d+\.\s+\*\*(.+?)\*\*\s*[—–-]\s*(.+)/) ?? line.match(/^\d+\.\s+(.+)/))
    .filter(Boolean)
    .map((m) => (m[2] ? `${m[1]} — ${m[2]}` : m[1]).trim())
    .slice(0, 5);
}

function cleanTruncatedMarkdown(text) {
  return text
    .replace(/\*\*[^*\n]*$/, "")
    .replace(/\*[^*\n]*$/, "")
    .replace(/`[^`\n]*$/, "")
    .replace(/\|[^\n]*$/, "")
    .replace(/#{1,3}\s[^\n]*$/, "")
    .trim();
}

function parseStatusLine(text, label) {
  const m = text.match(new RegExp(`\\*\\*${label}:\\*\\*\\s*(.+)`));
  return m?.[1]?.trim() ?? "unknown";
}

function isPlaceholderValue(val) {
  return !val || /^[—\-–]+$/.test(String(val).trim());
}

function filterMeasurements(rows) {
  return rows.filter((m) => {
    if (!m.metric || /^metric$/i.test(m.metric.trim())) return false;
    return !(isPlaceholderValue(m.before) && isPlaceholderValue(m.after));
  });
}

function parseInlineRubric(section) {
  const inline = section.match(/\*\*Rubric breakdown:\*\*\s*(.+)/)?.[1];
  if (!inline) return [];
  const items = [];
  for (const part of inline.split("·")) {
    const trimmed = part.trim();
    const m = trimmed.match(/^(.+?)\s+(\d+)\/(\d+)/);
    if (!m) continue;
    items.push({
      dimension: m[1].trim(),
      weight: m[3],
      score: m[2],
      notes: trimmed.match(/\(([^)]+)\)/)?.[1]?.trim() ?? "",
    });
  }
  return items;
}

function parseOutcomes(text) {
  const impl = parseStatusLine(text, "Implementation");
  const verify = parseStatusLine(text, "Verification");
  const score = text.match(/\*\*Score:\*\*\s*(\d+|—)\s*\/\s*100/)?.[1] ?? "—";
  const objectivesMet = text.match(/\*\*Objectives met:\*\*\s*([^*\n]+)/)?.[1]?.trim() ?? "—";
  const violations = text.match(/\*\*Anti-objectives violated:\*\*\s*([^*\n]+)/)?.[1]?.trim() ?? "—";
  const title =
    text.match(/^#\s+Sprint-\d+\s+Outcomes\s+[—–-]\s+(.+)/m)?.[1]?.trim() ??
    text.match(/^#\s+(.+)/m)?.[1]?.trim() ??
    null;
  const priority = text.match(/\*\*Priority:\*\*\s*(P\d+)/)?.[1] ?? null;
  const effort = text.match(/\*\*Effort:\*\*\s*([^\n*]+)/)?.[1]?.trim() ?? null;

  const implSummary = cleanTruncatedMarkdown(
    text
      .split("## Implementation summary")[1]
      ?.split("## Anti-objectives avoided")[0]
      ?.replace(/<!--[\s\S]*?-->/g, "")
      .trim()
      .slice(0, 800) ?? "",
  );

  const measurements = filterMeasurements(
    parseTableSection(text, "Measurements").map((r) => ({
      metric: r.col1,
      before: r.col2,
      after: r.col3,
      target: r.col4,
    })),
  );

  const rubricSection =
    text.split("## Verification Score")[1]?.split(/^## /m)[0] ??
    text.split("**Rubric breakdown**")[1]?.split(/^## /m)[0] ??
    "";
  const rubric = [];
  for (const line of rubricSection.split("\n")) {
    const m = line.match(/^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|/);
    if (!m) continue;
    const [dim, w, sc, notes] = [m[1], m[2], m[3], m[4]].map((v) => v.trim());
    if (dim.includes("---") || /dimension/i.test(dim)) continue;
    if (!/^\d+/.test(sc) && !/^\d+/.test(w)) continue;
    const isWeightFirst = w.includes("%");
    rubric.push({
      dimension: dim,
      weight: isWeightFirst ? w : sc,
      score: isWeightFirst ? sc : w,
      notes: notes || "",
    });
  }
  if (!rubric.length) {
    rubric.push(...parseInlineRubric(rubricSection));
  }

  const improvements = parseNumberedList(text, "Places for improvement");

  return {
    implementationStatus: impl,
    verificationStatus: verify,
    score,
    objectivesMet,
    antiObjectivesViolated: violations,
    title,
    priority,
    effort,
    implementationSummary: implSummary || null,
    measurements,
    rubric,
    improvements,
  };
}

export function collectWaveOutcomes(waveNum) {
  const waves = loadWaves();
  const meta = waves[String(waveNum)];
  if (!meta) throw new Error(`Unknown wave: ${waveNum}`);
  const sprints = meta.sprints;

  const items = [];
  for (const sprintNum of sprints) {
    const found = findSprintDir(sprintNum);
    if (!found) {
      items.push({ sprint: sprintNum, folder: null, error: "folder not found" });
      continue;
    }
    const outcomesPath = path.join(found.dir, "outcomes.md");
    if (!fs.existsSync(outcomesPath)) {
      items.push({ sprint: sprintNum, folder: found.folder, error: "outcomes.md missing" });
      continue;
    }
    const text = fs.readFileSync(outcomesPath, "utf8");
    items.push({
      sprint: sprintNum,
      folder: found.folder,
      path: outcomesPath,
      ...parseOutcomes(text),
    });
  }

  const completed = items.filter((i) => i.verificationStatus === "complete").length;
  const scored = items.filter((i) => i.score && i.score !== "—").map((i) => Number(i.score));
  const avgScore = scored.length
    ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length)
    : null;

  return {
    wave: Number(waveNum),
    waveName: meta.name,
    waveSummary: meta.summary,
    sprintCount: sprints.length,
    completedCount: completed,
    averageScore: avgScore,
    generatedAt: new Date().toISOString(),
    sprints: items,
  };
}

export function formatWaveMarkdown(summary) {
  const lines = [
    `# Wave ${summary.wave} outcomes — ${summary.waveName ?? ""}`.trim(),
    ``,
    summary.waveSummary ? `- **Focus:** ${summary.waveSummary}` : null,
    `- **Generated:** ${summary.generatedAt}`,
    `- **Sprints:** ${summary.completedCount}/${summary.sprintCount} verified complete`,
    summary.averageScore != null ? `- **Average score:** ${summary.averageScore}/100` : null,
    ``,
    `| Sprint | Folder | Impl | Verify | Score | Objectives |`,
    `|--------|--------|------|--------|-------|------------|`,
  ].filter(Boolean);

  for (const s of summary.sprints) {
    if (s.error) {
      lines.push(`| ${s.sprint} | — | — | — | — | ${s.error} |`);
      continue;
    }
    lines.push(
      `| ${s.sprint} | ${s.folder} | ${s.implementationStatus} | ${s.verificationStatus} | ${s.score} | ${s.objectivesMet} |`,
    );
  }

  lines.push("", "## Per-sprint notes", "");
  for (const s of summary.sprints) {
    if (s.error) continue;
    lines.push(`### ${s.folder}`, "", s.implementationSummary ?? "_No implementation notes yet._", "", "---", "");
  }

  return lines.join("\n");
}

function main() {
  const waveArg = process.argv.find((a, i) => process.argv[i - 1] === "--wave");
  const asJson = process.argv.includes("--json");
  if (!waveArg) {
    console.error("Usage: node collect-wave-outcomes.mjs --wave <1-7> [--json]");
    process.exit(1);
  }

  const summary = collectWaveOutcomes(waveArg);
  if (asJson) {
    console.log(JSON.stringify(summary, null, 2));
  } else {
    console.log(formatWaveMarkdown(summary));
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  main();
}
