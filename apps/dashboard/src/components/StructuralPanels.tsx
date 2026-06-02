import { useEffect, useState } from "react";
import { apiGet } from "../lib/api.js";
import { StatusPanel } from "./StatusPanel.js";
import { Panel } from "./ui/Panel.js";
import { MetricCell, MetricStrip } from "./ui/MetricCell.js";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
} from "./ui/DataTable.js";
import { cn } from "../lib/cn.js";

interface StructuralPanelsProps {
  memoryId: string;
}

type DetailTab = "chunks" | "structure" | "evolution" | "adjacency" | "density";

interface StructureView {
  memoryId: string;
  chunkingStrategy: string;
  fallbackUsed: boolean;
  fallbackReason?: string;
  headingHierarchy: string[];
  chunks: Array<{
    chunkId: string;
    chunkIndex: number;
    tokenCount: number;
    semanticDensityScore: number;
    lineage: {
      sectionPath: string[];
      headingHierarchy: string[];
      previousChunkId?: string;
      nextChunkId?: string;
      siblingChunkIds?: string[];
    };
    segmentationReason: {
      boundaryReason: string;
      preservedBulletGroup: boolean;
      headingInheritance: string[];
    };
    densityDetail: {
      informationalConcentration: number;
      contextualUniqueness: number;
      combinedScore: number;
      rankingInfluence: number;
    };
  }>;
}

interface EvolutionView {
  memoryId: string;
  evolution: {
    reinforcementScore: number;
    recencyScore: number;
    archivalScore: number;
    retrievalFrequency: number;
    archivalEligible: boolean;
    lastRetrievedAt?: string;
    lastReinforcedAt?: string;
  };
  history: Array<{
    timestamp: string;
    event: string;
    reason: string;
  }>;
  decayExplanation: {
    recencyScore: number;
    daysSinceLastRetrieval: number;
    formula: string;
  };
  archivalExplanation: {
    archivalEligible: boolean;
    archivalScore: number;
    threshold: number;
    reason: string;
  };
}

interface AdjacencyView {
  memoryId: string;
  adjacencyGraph: Array<{
    chunkId: string;
    chunkIndex: number;
    previousChunkId?: string;
    nextChunkId?: string;
    siblingChunkIds: string[];
    sectionPath: string[];
    headingHierarchy: string[];
  }>;
  sectionHierarchy: Array<{ path: string[]; chunkIds: string[] }>;
}

export function StructuralPanels({ memoryId }: StructuralPanelsProps) {
  const [tab, setTab] = useState<DetailTab>("structure");
  const [structure, setStructure] = useState<StructureView | null>(null);
  const [evolution, setEvolution] = useState<EvolutionView | null>(null);
  const [adjacency, setAdjacency] = useState<AdjacencyView | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const load = async () => {
      try {
        if (tab === "structure" || tab === "density") {
          const res = await apiGet<{ structure: StructureView }>(
            `/memory/${memoryId}/structure`,
          );
          setStructure(res.structure);
        } else if (tab === "evolution") {
          const res = await apiGet<{ evolution: EvolutionView }>(
            `/memory/${memoryId}/evolution`,
          );
          setEvolution(res.evolution);
        } else if (tab === "adjacency") {
          const res = await apiGet<{ adjacency: AdjacencyView }>(
            `/memory/${memoryId}/adjacency`,
          );
          setAdjacency(res.adjacency);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    if (tab !== "chunks") void load();
  }, [memoryId, tab]);

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "structure", label: "Structure" },
    { id: "evolution", label: "Evolution" },
    { id: "adjacency", label: "Adjacency" },
    { id: "density", label: "Density" },
  ];

  return (
    <Panel
      code="STR.04"
      title="Structural Intelligence"
      headerAction={
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              className={cn(
                "rounded-md px-2.5 py-1 font-metric text-[0.625rem] uppercase tracking-[0.04em] transition-colors",
                tab === t.id
                  ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)] border border-[rgba(56,189,248,0.2)]"
                  : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-secondary)]",
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      }
    >
      {loading && <StatusPanel title="Loading…" loading />}
      {error && <p className="font-metric text-xs text-[var(--color-danger)]">{error}</p>}

      {!loading && tab === "structure" && structure && (
        <div>
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">
            Strategy: <strong className="text-[var(--color-text-primary)]">{structure.chunkingStrategy}</strong>
            {structure.fallbackUsed && " · fallback used"}
            {structure.fallbackReason && ` · ${structure.fallbackReason}`}
          </p>
          {structure.headingHierarchy.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Heading hierarchy</h3>
              <ul className="list-inside list-disc text-sm text-[var(--color-text-secondary)]">
                {structure.headingHierarchy.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </div>
          )}
          <DataTable dense>
            <DataTableHead>
              <DataTableHeaderCell>#</DataTableHeaderCell>
              <DataTableHeaderCell>Section</DataTableHeaderCell>
              <DataTableHeaderCell>Boundary reason</DataTableHeaderCell>
              <DataTableHeaderCell>Bullet group</DataTableHeaderCell>
              <DataTableHeaderCell>Density</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {structure.chunks.map((c) => (
                <DataTableRow key={c.chunkId}>
                  <DataTableCell mono>{c.chunkIndex}</DataTableCell>
                  <DataTableCell>{c.lineage.sectionPath.join(" / ") || "(root)"}</DataTableCell>
                  <DataTableCell>{c.segmentationReason.boundaryReason}</DataTableCell>
                  <DataTableCell>{c.segmentationReason.preservedBulletGroup ? "yes" : "no"}</DataTableCell>
                  <DataTableCell mono>{c.semanticDensityScore.toFixed(1)}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      )}

      {!loading && tab === "evolution" && evolution && (
        <div>
          <MetricStrip columns={4} className="mb-4">
            <MetricCell label="Reinforcement" value={evolution.evolution.reinforcementScore.toFixed(3)} accent />
            <MetricCell label="Recency" value={evolution.evolution.recencyScore.toFixed(3)} />
            <MetricCell label="Archival score" value={evolution.evolution.archivalScore.toFixed(3)} />
            <MetricCell label="Retrievals" value={evolution.evolution.retrievalFrequency} />
          </MetricStrip>
          <p className="mb-1 text-sm text-[var(--color-text-secondary)]">Decay: {evolution.decayExplanation.formula}</p>
          <p className="mb-4 text-sm text-[var(--color-text-secondary)]">Archival: {evolution.archivalExplanation.reason}</p>
          {evolution.history.length > 0 && (
            <>
              <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">History</h3>
              <DataTable dense>
                <DataTableHead>
                  <DataTableHeaderCell>Time</DataTableHeaderCell>
                  <DataTableHeaderCell>Event</DataTableHeaderCell>
                  <DataTableHeaderCell>Reason</DataTableHeaderCell>
                </DataTableHead>
                <DataTableBody>
                  {evolution.history.slice(-10).reverse().map((h, i) => (
                    <DataTableRow key={`${h.timestamp}-${i}`}>
                      <DataTableCell mono>{new Date(h.timestamp).toLocaleString()}</DataTableCell>
                      <DataTableCell>{h.event}</DataTableCell>
                      <DataTableCell>{h.reason}</DataTableCell>
                    </DataTableRow>
                  ))}
                </DataTableBody>
              </DataTable>
            </>
          )}
        </div>
      )}

      {!loading && tab === "adjacency" && adjacency && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">Section hierarchy</h3>
          {adjacency.sectionHierarchy.map((s) => (
            <div key={s.path.join("/") || "root"} className="mb-1 text-sm text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-primary)]">{s.path.join(" / ") || "(root)"}</strong>
              <span className="text-[var(--color-text-tertiary)]"> · {s.chunkIds.length} chunks</span>
            </div>
          ))}
          <h3 className="mb-2 mt-4 text-sm font-semibold text-[var(--color-text-primary)]">Adjacency graph</h3>
          <DataTable dense>
            <DataTableHead>
              <DataTableHeaderCell>#</DataTableHeaderCell>
              <DataTableHeaderCell>Prev</DataTableHeaderCell>
              <DataTableHeaderCell>Next</DataTableHeaderCell>
              <DataTableHeaderCell>Siblings</DataTableHeaderCell>
              <DataTableHeaderCell>Section</DataTableHeaderCell>
            </DataTableHead>
            <DataTableBody>
              {adjacency.adjacencyGraph.map((a) => (
                <DataTableRow key={a.chunkId}>
                  <DataTableCell mono>{a.chunkIndex}</DataTableCell>
                  <DataTableCell mono>{a.previousChunkId?.slice(0, 8) ?? "—"}</DataTableCell>
                  <DataTableCell mono>{a.nextChunkId?.slice(0, 8) ?? "—"}</DataTableCell>
                  <DataTableCell mono>{a.siblingChunkIds.length}</DataTableCell>
                  <DataTableCell>{a.sectionPath.join(" / ") || "(root)"}</DataTableCell>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
        </div>
      )}

      {!loading && tab === "density" && structure && (
        <DataTable dense>
          <DataTableHead>
            <DataTableHeaderCell>#</DataTableHeaderCell>
            <DataTableHeaderCell>Concentration</DataTableHeaderCell>
            <DataTableHeaderCell>Uniqueness</DataTableHeaderCell>
            <DataTableHeaderCell>Combined</DataTableHeaderCell>
            <DataTableHeaderCell>Ranking influence</DataTableHeaderCell>
          </DataTableHead>
          <DataTableBody>
            {structure.chunks.map((c) => (
              <DataTableRow key={c.chunkId}>
                <DataTableCell mono>{c.chunkIndex}</DataTableCell>
                <DataTableCell mono>{(c.densityDetail.informationalConcentration * 100).toFixed(1)}%</DataTableCell>
                <DataTableCell mono>{(c.densityDetail.contextualUniqueness * 100).toFixed(1)}%</DataTableCell>
                <DataTableCell mono>{c.densityDetail.combinedScore.toFixed(1)}</DataTableCell>
                <DataTableCell mono>{c.densityDetail.rankingInfluence.toFixed(4)}</DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      )}
    </Panel>
  );
}
