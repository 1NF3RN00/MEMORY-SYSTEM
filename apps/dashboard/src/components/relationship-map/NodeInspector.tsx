import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { apiGet } from "../../lib/api.js";
import { Badge } from "../ui/Badge.js";
import type {
  MemoryDetail,
  MemoryHistoryTimeline,
  RelationshipGraphEdge,
  RelationshipGraphNode,
} from "./types.js";
import { RELATIONSHIP_COLORS } from "./constants.js";
import { NeighborhoodViewer } from "./NeighborhoodViewer.js";
import { RelationshipEvolutionPanel } from "./RelationshipEvolutionPanel.js";

interface NodeInspectorProps {
  node: RelationshipGraphNode | null;
  edges: RelationshipGraphEdge[];
  onExpandNeighborhood: (nodeId: string) => void;
  isExpanded: boolean;
}

export function NodeInspector({
  node,
  edges,
  onExpandNeighborhood,
  isExpanded,
}: NodeInspectorProps) {
  const [detail, setDetail] = useState<MemoryDetail | null>(null);
  const [history, setHistory] = useState<MemoryHistoryTimeline | null>(null);
  const [relationships, setRelationships] = useState<Array<{
    relationshipId: string;
    confidence: number;
    reinforcementScore?: number;
    retrievalFrequency?: number;
    evolutionHistory: Array<{
      timestamp: string;
      event: string;
      previousConfidence: number;
      newConfidence: number;
      previousWeight: number;
      newWeight: number;
      reason: string;
    }>;
  }>>([]);
  const [neighborhood, setNeighborhood] = useState<{
    anchorMemoryId: string;
    workspaceId: string;
    nodes: Array<{ memoryId: string; label: string; memoryType: string; domain: string; confidence: number; relationshipType: string; generatedFrom: string[]; depth: number }>;
    edges: Array<{ source: string; target: string; relationshipType: string; confidence: number; weight: number; generatedFrom: string[] }>;
    semanticNeighborhood: string[];
    operationalCluster: string;
    reasoning: string[];
    generatedAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!node) {
      setDetail(null);
      setHistory(null);
      setRelationships([]);
      setNeighborhood(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      apiGet<MemoryDetail>(`/memory/${node.id}`).catch(() => null),
      apiGet<{ timeline: MemoryHistoryTimeline }>(`/history/${node.id}`).catch(() => null),
      apiGet<{ relationships: typeof relationships }>(`/relationships/${node.id}`).catch(() => null),
    ]).then(([mem, hist, rels]) => {
      if (cancelled) return;
      setDetail(mem);
      setHistory(hist?.timeline ?? null);
      setRelationships(rels?.relationships ?? []);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [node?.id]);

  useEffect(() => {
    if (!node || !isExpanded) {
      setNeighborhood(null);
      return;
    }

    let cancelled = false;
    apiGet<typeof neighborhood>(`/relationships/${node.id}/neighborhood`)
      .then((data) => {
        if (!cancelled) setNeighborhood(data);
      })
      .catch(() => {
        if (!cancelled) setNeighborhood(null);
      });

    return () => {
      cancelled = true;
    };
  }, [node?.id, isExpanded]);

  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-2)]">
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-[var(--color-text-muted)]" fill="none">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <p className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          NODE.INSPECT
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
          Select a memory node to inspect retrieval history, reinforcement evolution, and adjacency
        </p>
      </div>
    );
  }

  const connectedEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  );

  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex h-full flex-col overflow-hidden"
    >
      <header className="shrink-0 border-b border-[var(--color-border-subtle)] p-4">
        <span className="font-metric text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          MEM.INSPECT
        </span>
        <h3 className="mt-1 truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {node.label}
        </h3>
        <p className="mt-0.5 font-metric text-[0.625rem] text-[var(--color-text-tertiary)]">
          {node.id}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="default">{node.memoryType}</Badge>
          <Badge variant="default">{node.domain}</Badge>
          {node.archived && <Badge variant="danger">Archived</Badge>}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading && (
          <p className="font-metric text-xs text-[var(--color-text-muted)]">Loading node telemetry…</p>
        )}

        <InspectorSection title="Operational Metrics" code="OPS.01">
          <MetricGrid
            items={[
              { label: "Access Count", value: String(node.accessCount) },
              { label: "Avg Rank", value: node.averageRank.toFixed(2) },
              { label: "Avg Score", value: node.averageScore.toFixed(4) },
              { label: "Reinforcement", value: node.reinforcementScore.toFixed(3) },
              { label: "Semantic Density", value: node.semanticDensity.toFixed(3) },
              { label: "Ranking Influence", value: node.rankingInfluence.toFixed(3) },
            ]}
          />
        </InspectorSection>

        <InspectorSection title="Adjacency & Lineage" code="OPS.02">
          <p className="mb-2 text-xs text-[var(--color-text-tertiary)]">
            {connectedEdges.length} relationship edge{connectedEdges.length !== 1 ? "s" : ""} connected
          </p>
          <div className="space-y-1.5 max-h-32 overflow-y-auto">
            {connectedEdges.slice(0, 8).map((edge) => {
              const otherId = edge.source === node.id ? edge.target : edge.source;
              const colors = RELATIONSHIP_COLORS[edge.relationshipType];
              return (
                <div
                  key={edge.id}
                  className="flex items-center justify-between rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2 py-1.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: colors.stroke }}
                    />
                    <span className="truncate font-metric text-[0.625rem] text-[var(--color-text-secondary)]">
                      {otherId.slice(0, 10)}…
                    </span>
                  </div>
                  <span className="font-metric text-[0.5625rem] tabular-nums text-[var(--color-text-muted)]">
                    {(edge.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => onExpandNeighborhood(node.id)}
            className="mt-2 w-full rounded border border-[var(--color-border-default)] bg-[var(--color-surface-2)] px-3 py-1.5 font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-muted)]"
          >
            {isExpanded ? "Collapse Neighborhood" : "Expand Neighborhood"}
          </button>
          {isExpanded && (
            <div className="mt-3">
              <NeighborhoodViewer neighborhood={neighborhood} loading={!neighborhood && isExpanded} />
            </div>
          )}
        </InspectorSection>

        {relationships.length > 0 && (
          <InspectorSection title="Relationship Evolution" code="OPS.02b">
            <RelationshipEvolutionPanel
              evolutionHistory={relationships[0]?.evolutionHistory ?? []}
              confidence={relationships[0]?.confidence ?? 0}
              {...(relationships[0]?.reinforcementScore !== undefined
                ? { reinforcementScore: relationships[0].reinforcementScore }
                : {})}
              {...(relationships[0]?.retrievalFrequency !== undefined
                ? { retrievalFrequency: relationships[0].retrievalFrequency }
                : {})}
            />
          </InspectorSection>
        )}

        {history && history.retrievalFrequency.length > 0 && (
          <InspectorSection title="Retrieval History" code="OPS.03">
            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {history.retrievalFrequency.slice(0, 6).map((r) => (
                <div
                  key={r.retrievalTraceId}
                  className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2 py-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-metric text-[0.5625rem] text-[var(--color-text-muted)]">
                      rank {r.rank ?? "—"}
                    </span>
                    <Link
                      to={`/retrieval-traces/${r.retrievalTraceId}`}
                      className="font-metric text-[0.5625rem] text-[var(--color-accent)] no-underline hover:underline"
                    >
                      trace →
                    </Link>
                  </div>
                  <p className="mt-0.5 truncate text-[0.6875rem] text-[var(--color-text-secondary)]">
                    {r.query}
                  </p>
                </div>
              ))}
            </div>
          </InspectorSection>
        )}

        {history && history.reinforcementProgression.length > 0 && (
          <InspectorSection title="Reinforcement Evolution" code="OPS.04">
            <div className="space-y-1">
              {history.reinforcementProgression.slice(-5).map((r, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-16 font-metric text-[0.5625rem] text-[var(--color-text-muted)]">
                    {r.timestamp.slice(11, 19)}
                  </span>
                  <div className="flex-1 h-1 overflow-hidden rounded-full bg-[var(--color-surface-3)]">
                    <div
                      className="h-full rounded-full bg-purple-400/70"
                      style={{ width: `${Math.min(100, r.reinforcementScore * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-metric text-[0.5625rem] tabular-nums text-[var(--color-text-tertiary)]">
                    {r.reinforcementScore.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </InspectorSection>
        )}

        {detail && (
          <InspectorSection title="Memory Detail" code="OPS.05">
            <p className="text-xs text-[var(--color-text-secondary)] line-clamp-4">
              {detail.memory.normalizedContent.slice(0, 280)}
              {detail.memory.normalizedContent.length > 280 ? "…" : ""}
            </p>
            <Link
              to={`/memory/${node.id}`}
              className="mt-2 inline-block font-metric text-[0.625rem] text-[var(--color-accent)] no-underline hover:underline"
            >
              Open in Memory Explorer →
            </Link>
          </InspectorSection>
        )}
      </div>
    </motion.div>
  );
}

function InspectorSection({
  title,
  code,
  children,
}: {
  title: string;
  code: string;
  children: ReactNode;
}) {
  return (
    <section>
      <header className="mb-2 flex items-baseline gap-2">
        <span className="font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
          {code}
        </span>
        <h4 className="text-xs font-semibold text-[var(--color-text-primary)]">{title}</h4>
      </header>
      {children}
    </section>
  );
}

function MetricGrid({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2 py-1.5"
        >
          <span className="block font-metric text-[0.5625rem] uppercase tracking-[0.04em] text-[var(--color-text-muted)]">
            {item.label}
          </span>
          <span className="mt-0.5 block font-metric text-sm font-semibold tabular-nums text-[var(--color-text-primary)]">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}
