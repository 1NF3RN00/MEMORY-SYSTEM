/**
 * Sprint-10 verification: React.memo home panels
 * OP-9 / FE-005 — poll-driven re-renders on home panels
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { OperationalEvent } from "./types.js";
import type { IntelligencePanelData, SystemIndicators } from "./types.js";
import {
  homePanelSlicesUnchanged,
  shallowEqualEvents,
  shallowEqualIndicators,
  shallowEqualPanelData,
} from "./telemetryShallowEqual.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dashboardSrc = join(__dirname, "../..");

function readSrc(relativePath: string): string {
  return readFileSync(join(dashboardSrc, relativePath), "utf8");
}

const SAMPLE_INDICATORS: SystemIndicators = {
  retrievalLatencyMs: 42,
  activeMemories: 12,
  ingestionThroughput: 1.2,
  compressionEfficiency: 0.35,
  systemHealth: "nominal",
};

const SAMPLE_PANEL: IntelligencePanelData = {
  activeContextWindow: {
    tokensAssembled: 1200,
    compressionEfficiency: 0.35,
    strategicMemoriesActive: 4,
  },
  retrievalConfidence: {
    contextualConfidence: null,
    lowConfidenceCount: 1,
  },
  workspaceState: {
    activeMemories: 12,
    transientResearchMemories: 2,
    expiringContexts: 0,
  },
  operationalHistorian: {
    mostActiveScope: "Product roadmap",
  },
  intelligenceDrift: {
    staleStrategicMemories: 0,
  },
};

const SAMPLE_EVENTS: OperationalEvent[] = [
  {
    id: "ret-abc",
    category: "RETRIEVAL",
    title: "Retrieval executed",
    detail: "completed · 42ms",
    timestamp: new Date("2026-06-08T12:00:00Z"),
    metadata: { trace: "abc", status: "completed" },
    lineage: "vector → rerank",
    source: "ret-abc",
  },
];

describe("Sprint-10 — React.memo home panels", () => {
  describe("objective 1: panels skip re-render when telemetry unchanged", () => {
    it("wraps OperationalIntelligencePanels with memo", () => {
      const source = readSrc("components/homepage/OperationalIntelligencePanels.tsx");
      expect(source).toMatch(/import \{ memo \} from "react"/);
      expect(source).toMatch(/export const OperationalIntelligencePanels = memo\(/);
    });

    it("wraps LiveOperationalStream with memo", () => {
      const source = readSrc("components/homepage/LiveOperationalStream.tsx");
      expect(source).toMatch(/import \{ memo,/);
      expect(source).toMatch(/export const LiveOperationalStream = memo\(/);
    });

    it("wraps OperationalSystemBar with memo", () => {
      const source = readSrc("components/homepage/OperationalSystemBar.tsx");
      expect(source).toMatch(/import \{ memo, useCallback \} from "react"/);
      expect(source).toMatch(/export const OperationalSystemBar = memo\(/);
    });

    it("WorkspaceTelemetryProvider uses React Query structural sharing for unchanged polls", () => {
      const source = readSrc("context/WorkspaceTelemetryContext.tsx");
      expect(source).toMatch(/structuralSharing:\s*true/);
      expect(source).toMatch(/useQuery/);
    });

    it("shallowEqualIndicators treats identical values as equal", () => {
      expect(shallowEqualIndicators(SAMPLE_INDICATORS, { ...SAMPLE_INDICATORS })).toBe(true);
      expect(
        shallowEqualIndicators(SAMPLE_INDICATORS, {
          ...SAMPLE_INDICATORS,
          activeMemories: 99,
        }),
      ).toBe(false);
    });

    it("shallowEqualPanelData treats identical values as equal", () => {
      expect(shallowEqualPanelData(SAMPLE_PANEL, structuredClone(SAMPLE_PANEL))).toBe(true);
      expect(
        shallowEqualPanelData(SAMPLE_PANEL, {
          ...SAMPLE_PANEL,
          workspaceState: { ...SAMPLE_PANEL.workspaceState, activeMemories: 99 },
        }),
      ).toBe(false);
    });

    it("shallowEqualEvents ignores volatile timestamps", () => {
      const left = SAMPLE_EVENTS;
      const right: OperationalEvent[] = [
        {
          ...SAMPLE_EVENTS[0]!,
          timestamp: new Date("2026-06-08T12:05:00Z"),
        },
      ];
      expect(shallowEqualEvents(left, right)).toBe(true);
    });

    it("homePanelSlicesUnchanged returns true for equivalent slices", () => {
      expect(
        homePanelSlicesUnchanged(
          {
            indicators: SAMPLE_INDICATORS,
            panelData: SAMPLE_PANEL,
            events: SAMPLE_EVENTS,
          },
          {
            indicators: { ...SAMPLE_INDICATORS },
            panelData: structuredClone(SAMPLE_PANEL),
            events: [
              {
                ...SAMPLE_EVENTS[0]!,
                timestamp: new Date("2026-06-08T12:05:00Z"),
              },
            ],
          },
        ),
      ).toBe(true);
    });
  });

  describe("objective 2: stable callback props", () => {
    it("OperationalSystemBar uses useCallback for command palette handler", () => {
      const source = readSrc("components/homepage/OperationalSystemBar.tsx");
      expect(source).toMatch(/const handleOpenCommandPalette = useCallback\(/);
      expect(source).toMatch(/onClick=\{handleOpenCommandPalette\}/);
      expect(source).not.toMatch(/onClick=\{\(\) => openCommandPalette\(\)\}/);
    });
  });

  describe("objective 3: no visual regressions", () => {
    it("HomePage layout grid is unchanged", () => {
      const source = readSrc("pages/HomePage.tsx");
      expect(source).toMatch(
        /grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-\[minmax\(240px,280px\)_1fr_minmax\(240px,300px\)\]/,
      );
      expect(source).toMatch(/<OperationalSystemBar indicators=\{indicators\} \/>/);
      expect(source).toMatch(/<LiveOperationalStream events=\{events\} loading=\{loading\} \/>/);
      expect(source).toMatch(/<OperationalIntelligencePanels[\s\S]*data=\{panelData\}[\s\S]*loading=\{loading\}/);
    });
  });

  describe("anti-objectives", () => {
    it("shallowEqualEvents detects new stream events", () => {
      const withNewEvent: OperationalEvent[] = [
        ...SAMPLE_EVENTS,
        {
          id: "ing-new",
          category: "INGESTION",
          title: "Ingestion completed",
          detail: "Memory xyz",
          timestamp: new Date(),
        },
      ];
      expect(shallowEqualEvents(SAMPLE_EVENTS, withNewEvent)).toBe(false);
    });

    it("does not memo ContextualIntelligenceMap (out of sprint scope)", () => {
      const source = readSrc("components/homepage/ContextualIntelligenceMap.tsx");
      expect(source).not.toMatch(/memo\(/);
    });
  });

  describe("profiler model: commit delta on 15s poll", () => {
    const PANEL_COUNT = 3;

    function freshPollPayload(events: OperationalEvent[] = SAMPLE_EVENTS) {
      return {
        indicators: { ...SAMPLE_INDICATORS },
        panelData: structuredClone(SAMPLE_PANEL),
        events: events.map((event) => ({ ...event, timestamp: new Date() })),
      };
    }

    it("unchanged polls produce zero HomePage commits (pre-sprint: one per poll)", () => {
      let prev = freshPollPayload();
      let homeCommitsAfter = 0;

      for (let poll = 0; poll < 4; poll++) {
        const next = freshPollPayload();
        if (!homePanelSlicesUnchanged(prev, next)) {
          homeCommitsAfter++;
          prev = next;
        }
      }

      expect(homeCommitsAfter).toBe(0);
    });

    it("unchanged polls skip all panel commits (pre-sprint: 3 per poll)", () => {
      let prev = freshPollPayload();
      let panelCommitsAfter = 0;
      const pollCount = 4;
      const panelCommitsBefore = pollCount * PANEL_COUNT;

      for (let poll = 0; poll < pollCount; poll++) {
        const next = freshPollPayload();
        if (!homePanelSlicesUnchanged(prev, next)) {
          prev = next;
          panelCommitsAfter += PANEL_COUNT;
        }
      }

      expect(panelCommitsAfter).toBe(0);
      const reductionPct = ((panelCommitsBefore - panelCommitsAfter) / panelCommitsBefore) * 100;
      expect(reductionPct).toBeGreaterThanOrEqual(50);
    });

    it("new stream events trigger update and only LiveOperationalStream would commit", () => {
      const prev = freshPollPayload();
      const next = freshPollPayload([
        {
          id: "ing-new",
          category: "INGESTION",
          title: "Ingestion completed",
          detail: "Memory xyz",
          timestamp: new Date(),
        },
        ...SAMPLE_EVENTS,
      ]);

      expect(homePanelSlicesUnchanged(prev, next)).toBe(false);

      const indicatorsChanged = !shallowEqualIndicators(prev.indicators, next.indicators);
      const panelChanged = !shallowEqualPanelData(prev.panelData, next.panelData);
      const eventsChanged = !shallowEqualEvents(prev.events, next.events);

      expect(eventsChanged).toBe(true);
      expect(indicatorsChanged).toBe(false);
      expect(panelChanged).toBe(false);

      const panelCommitsOnEventPoll = (indicatorsChanged ? 1 : 0) + (panelChanged ? 1 : 0) + (eventsChanged ? 1 : 0);
      expect(panelCommitsOnEventPoll).toBe(1);
    });

    it("LiveOperationalStream still reacts to events prop changes", () => {
      const source = readSrc("components/homepage/LiveOperationalStream.tsx");
      expect(source).toMatch(/useEffect\(\(\) => \{[\s\S]*\}, \[events\]\)/);
    });
  });
});
