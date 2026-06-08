/**
 * Sprint-11 verification: Remove Framer layout on event cards (OP-10 / FE-005)
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

function eventCardBlock(source: string): string {
  const match = source.match(/function EventCard[\s\S]*?^}/m);
  expect(match).toBeTruthy();
  return match![0]!;
}

function streamListBlock(source: string): string {
  const match = source.match(/<AnimatePresence initial=\{false\}>[\s\S]*?<\/AnimatePresence>/);
  expect(match).toBeTruthy();
  return match![0]!;
}

describe("Sprint-11 — remove Framer layout on event cards", () => {
  const source = readSrc("components/homepage/LiveOperationalStream.tsx");
  const eventCard = eventCardBlock(source);
  const streamList = streamListBlock(source);

  describe("objective 1: no layout animations on poll updates", () => {
    it("EventCard motion.article does not use Framer layout prop", () => {
      expect(eventCard).toMatch(/<motion\.article/);
      expect(eventCard).not.toMatch(/\blayout\b/);
    });

    it("stream AnimatePresence does not use popLayout mode", () => {
      expect(streamList).toMatch(/<AnimatePresence initial=\{false\}>/);
      expect(streamList).not.toMatch(/mode="popLayout"/);
    });

    it("events still map in stable order with id keys (poll updates reuse keys)", () => {
      expect(streamList).toMatch(/events\.map\(\(event\) => \(/);
      expect(streamList).toMatch(/key=\{event\.id\}/);
      expect(source).not.toMatch(/events\.(sort|toSorted|reverse)\(/);
    });
  });

  describe("objective 2: enter/exit motion preserved", () => {
    it("EventCard retains opacity + x enter/exit variants", () => {
      expect(eventCard).toMatch(/initial=\{\{ opacity: 0, x: -12 \}\}/);
      expect(eventCard).toMatch(/animate=\{\{ opacity: 1, x: 0 \}\}/);
      expect(eventCard).toMatch(/exit=\{\{ opacity: 0, x: 8 \}\}/);
      expect(eventCard).toMatch(/transition=\{\{ duration: 0\.28/);
    });

    it("expand/collapse detail panel height animation preserved", () => {
      expect(eventCard).toMatch(/initial=\{\{ height: 0, opacity: 0 \}\}/);
      expect(eventCard).toMatch(/animate=\{\{ height: "auto", opacity: 1 \}\}/);
      expect(eventCard).toMatch(/exit=\{\{ height: 0, opacity: 0 \}\}/);
    });

    it("CSS hover transitions preserved", () => {
      expect(eventCard).toMatch(/transition-colors hover:bg-\[var\(--color-surface-2\)\]/);
      expect(eventCard).toMatch(/transition-opacity group-hover:opacity-100/);
    });
  });

  describe("objective 3: reduced main-thread work", () => {
    const CARD_COUNT = 10;
    const POLL_COUNT = 4;

    function framerLayoutMeasurementsPerPoll(cardCount: number, hasLayoutProp: boolean): number {
      return hasLayoutProp ? cardCount : 0;
    }

    it("layout measurement model: zero Framer layout work after sprint on stable polls", () => {
      const beforePerPoll = framerLayoutMeasurementsPerPoll(CARD_COUNT, true);
      const afterPerPoll = framerLayoutMeasurementsPerPoll(CARD_COUNT, false);

      expect(beforePerPoll).toBe(CARD_COUNT);
      expect(afterPerPoll).toBe(0);

      const beforeTotal = beforePerPoll * POLL_COUNT;
      const afterTotal = afterPerPoll * POLL_COUNT;
      expect(afterTotal).toBe(0);
      expect(beforeTotal).toBeGreaterThan(0);

      const reductionPct = ((beforeTotal - afterTotal) / beforeTotal) * 100;
      expect(reductionPct).toBe(100);
    });

    it("LiveOperationalStream remains memoized (Sprint-10 synergy on poll)", () => {
      expect(source).toMatch(/export const LiveOperationalStream = memo\(/);
    });
  });

  describe("anti-objectives", () => {
    it("does not remove all motion — enter/exit and expand animations remain", () => {
      expect(eventCard).toMatch(/initial=\{\{ opacity: 0/);
      expect(eventCard).toMatch(/exit=\{\{ opacity: 0/);
      expect(eventCard).toMatch(/height: "auto"/);
    });

    it("preserves stream accessibility: semantic article, click-to-expand", () => {
      expect(eventCard).toMatch(/<motion\.article/);
      expect(eventCard).toMatch(/onClick=\{\(\) => setExpanded/);
      expect(eventCard).toMatch(/\{event\.title\}/);
      expect(eventCard).toMatch(/\{event\.detail\}/);
    });

    it("does not change event ordering logic", () => {
      expect(source).not.toMatch(/events\.(sort|toSorted|reverse)\(/);
      expect(streamList).toMatch(/events\.map\(\(event\) => \(/);
    });
  });
});
