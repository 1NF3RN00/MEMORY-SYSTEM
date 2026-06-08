import type { OperationalEvent } from "./types.js";
import type { IntelligencePanelData, SystemIndicators } from "./types.js";

export function shallowEqualIndicators(a: SystemIndicators, b: SystemIndicators): boolean {
  return (
    a.retrievalLatencyMs === b.retrievalLatencyMs &&
    a.activeMemories === b.activeMemories &&
    a.ingestionThroughput === b.ingestionThroughput &&
    a.compressionEfficiency === b.compressionEfficiency &&
    a.systemHealth === b.systemHealth
  );
}

export function shallowEqualPanelData(a: IntelligencePanelData, b: IntelligencePanelData): boolean {
  return (
    a.activeContextWindow.tokensAssembled === b.activeContextWindow.tokensAssembled &&
    a.activeContextWindow.compressionEfficiency === b.activeContextWindow.compressionEfficiency &&
    a.activeContextWindow.strategicMemoriesActive === b.activeContextWindow.strategicMemoriesActive &&
    a.retrievalConfidence.contextualConfidence === b.retrievalConfidence.contextualConfidence &&
    a.retrievalConfidence.lowConfidenceCount === b.retrievalConfidence.lowConfidenceCount &&
    a.workspaceState.activeMemories === b.workspaceState.activeMemories &&
    a.workspaceState.transientResearchMemories === b.workspaceState.transientResearchMemories &&
    a.workspaceState.expiringContexts === b.workspaceState.expiringContexts &&
    a.operationalHistorian.mostActiveScope === b.operationalHistorian.mostActiveScope &&
    a.intelligenceDrift.staleStrategicMemories === b.intelligenceDrift.staleStrategicMemories
  );
}

/** Compare event identity fields; timestamps are ignored (drift events use volatile `new Date()`). */
export function shallowEqualEvents(a: OperationalEvent[], b: OperationalEvent[]): boolean {
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.id !== right.id ||
      left.category !== right.category ||
      left.title !== right.title ||
      left.detail !== right.detail ||
      left.lineage !== right.lineage ||
      left.source !== right.source
    ) {
      return false;
    }

    const leftMeta = left.metadata;
    const rightMeta = right.metadata;
    if (leftMeta === rightMeta) continue;
    if (!leftMeta || !rightMeta) return false;

    const keys = Object.keys(leftMeta);
    if (keys.length !== Object.keys(rightMeta).length) return false;
    for (const key of keys) {
      if (leftMeta[key] !== rightMeta[key]) return false;
    }
  }

  return true;
}

export function homePanelSlicesUnchanged(
  prev: {
    indicators: SystemIndicators;
    panelData: IntelligencePanelData;
    events: OperationalEvent[];
  },
  next: {
    indicators: SystemIndicators;
    panelData: IntelligencePanelData;
    events: OperationalEvent[];
  },
): boolean {
  return (
    shallowEqualIndicators(prev.indicators, next.indicators) &&
    shallowEqualPanelData(prev.panelData, next.panelData) &&
    shallowEqualEvents(prev.events, next.events)
  );
}
