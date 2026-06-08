export type OperationalEventCategory =
  | "INGESTION"
  | "RETRIEVAL"
  | "REINFORCEMENT"
  | "COMPRESSION"
  | "MEMORY_HEALTH";

export interface OperationalEvent {
  id: string;
  category: OperationalEventCategory;
  title: string;
  detail: string;
  timestamp: Date;
  metadata?: Record<string, string>;
  lineage?: string;
  source?: string;
}

export interface SystemIndicators {
  retrievalLatencyMs: number;
  activeMemories: number;
  ingestionThroughput: number;
  compressionEfficiency: number;
  systemHealth: "nominal" | "degraded" | "critical";
}

export interface IntelligencePanelData {
  activeContextWindow: {
    tokensAssembled: number;
    compressionEfficiency: number;
    strategicMemoriesActive: number;
  };
  retrievalConfidence: {
    /** Mean ranking score; null when ranking breakdown was not fetched on home load. */
    contextualConfidence: number | null;
    lowConfidenceCount: number;
  };
  workspaceState: {
    activeMemories: number;
    transientResearchMemories: number;
    expiringContexts: number;
  };
  operationalHistorian: {
    mostActiveScope: string;
  };
  intelligenceDrift: {
    staleStrategicMemories: number;
  };
}

export interface MemoryGraphNode {
  id: string;
  label: string;
  domain: string;
  x?: number;
  y?: number;
  state: "idle" | "active" | "rejected" | "compressed";
  accessWeight: number;
}

export interface MemoryGraphLink {
  source: string;
  target: string;
  strength: number;
  active: boolean;
}
