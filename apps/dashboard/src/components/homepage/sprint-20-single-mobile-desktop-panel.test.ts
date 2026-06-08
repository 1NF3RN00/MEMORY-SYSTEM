/**
 * Sprint-20 verification: Single mobile/desktop panel instance (OP-19 / FE-005)
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

function countComponentMounts(source: string, component: string): number {
  const pattern = new RegExp(`<${component}[\\s>]`, "g");
  return (source.match(pattern) ?? []).length;
}

describe("Sprint-20 — single mobile/desktop panel instance", () => {
  const homeSource = readSrc("pages/HomePage.tsx");

  describe("objective 1: one stream + one panels in tree", () => {
    it("mounts LiveOperationalStream exactly once", () => {
      expect(countComponentMounts(homeSource, "LiveOperationalStream")).toBe(1);
    });

    it("mounts OperationalIntelligencePanels exactly once", () => {
      expect(countComponentMounts(homeSource, "OperationalIntelligencePanels")).toBe(1);
    });

    it("does not use hidden lg:block / lg:hidden duplicate panel pattern", () => {
      expect(homeSource).not.toMatch(/hidden min-h-0 lg:block/);
      expect(homeSource).not.toMatch(/lg:hidden[\s\S]*LiveOperationalStream/);
    });
  });

  describe("objective 2: responsive CSS", () => {
    it("keeps desktop three-column grid template", () => {
      expect(homeSource).toMatch(
        /grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-\[minmax\(240px,280px\)_1fr_minmax\(240px,300px\)\]/,
      );
    });

    it("uses lg:contents so mobile footer wrapper defers to desktop grid placement", () => {
      expect(homeSource).toMatch(/lg:contents/);
      expect(homeSource).toMatch(/lg:col-start-1 lg:row-start-1/);
      expect(homeSource).toMatch(/lg:col-start-3 lg:row-start-1/);
    });

    it("preserves mobile footer constraints (border-t, max-h, sm two-column)", () => {
      expect(homeSource).toMatch(/max-h-\[40vh\]/);
      expect(homeSource).toMatch(/border-t border-\[var\(--color-border-subtle\)\]/);
      expect(homeSource).toMatch(/sm:grid-cols-2/);
    });
  });

  describe("objective 3: same subscriptions", () => {
    it("uses single useOperationalHomeData hook at page level", () => {
      expect(homeSource).toMatch(/useOperationalHomeData\(\)/);
      expect((homeSource.match(/useOperationalHomeData\(\)/g) ?? []).length).toBe(1);
    });

    it("passes shared poll data props to the single panel instances", () => {
      expect(homeSource).toMatch(/<LiveOperationalStream events=\{events\} loading=\{loading\} \/>/);
      expect(homeSource).toMatch(
        /<OperationalIntelligencePanels[\s\S]*data=\{panelData\}[\s\S]*loading=\{loading\}/,
      );
    });
  });

  describe("anti-objectives", () => {
    it("does not add duplicate poll hooks inside panel components", () => {
      const streamSource = readSrc("components/homepage/LiveOperationalStream.tsx");
      const panelsSource = readSrc("components/homepage/OperationalIntelligencePanels.tsx");
      expect(streamSource).not.toMatch(/useOperationalHomeData/);
      expect(panelsSource).not.toMatch(/useOperationalHomeData/);
    });

    it("ContextualIntelligenceMap remains a single center column instance", () => {
      expect(countComponentMounts(homeSource, "ContextualIntelligenceMap")).toBe(1);
      expect(homeSource).toMatch(/lg:col-start-2 lg:row-start-1/);
    });
  });
});
