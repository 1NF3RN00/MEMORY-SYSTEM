import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { apiGet } from "../lib/api.js";
import { RelationshipCanvas } from "../components/relationship-map/RelationshipCanvas.js";
import { EdgeExplainability } from "../components/relationship-map/EdgeExplainability.js";
import { NodeInspector } from "../components/relationship-map/NodeInspector.js";
import { OperationalTimeline } from "../components/relationship-map/OperationalTimeline.js";
import { RetrievalReplayOverlay } from "../components/relationship-map/RetrievalReplayOverlay.js";
import {
  RELATIONSHIP_COLORS,
  domainColor,
} from "../components/relationship-map/constants.js";
import type {
  GraphTimelineEvent,
  MemoryRelationshipType,
  RelationshipGraphEdge,
  RelationshipGraphView,
} from "../components/relationship-map/types.js";

const ALL_EDGE_TYPES: MemoryRelationshipType[] = [
  "co_retrieval",
  "retrieval_cooccurrence",
  "semantic_overlap",
  "semantic_similarity",
  "same_lineage",
  "metadata_overlap",
  "chunk_adjacency",
  "structural_adjacency",
  "operational_association",
];

function RelationshipMapContent() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusMemoryId = searchParams.get("focus");

  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [graph, setGraph] = useState<RelationshipGraphView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(focusMemoryId);
  const [hoveredEdge, setHoveredEdge] = useState<RelationshipGraphEdge | null>(null);
  const [edgeTooltipPos, setEdgeTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [visibleDomains, setVisibleDomains] = useState<Set<string>>(new Set());
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Set<string>>(
    new Set(ALL_EDGE_TYPES),
  );
  const [expandedNeighborhoods, setExpandedNeighborhoods] = useState<Set<string>>(new Set());
  const [scrubPosition, setScrubPosition] = useState(1);
  const [activeTimelineEvent, setActiveTimelineEvent] = useState<GraphTimelineEvent | null>(null);
  const [activeReplayTraceId, setActiveReplayTraceId] = useState<string | null>(null);
  const [replayProgress, setReplayProgress] = useState(0);

  useEffect(() => {
    apiGet<{ id: string }>("/workspaces/default")
      .then((ws) => setWorkspaceId(ws.id))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  useEffect(() => {
    if (!workspaceId) return;

    setLoading(true);
    apiGet<RelationshipGraphView>(`/relationships/graph?workspaceId=${workspaceId}`)
      .then((data) => {
        setGraph(data);
        setVisibleDomains(new Set(data.domains.map((d) => d.domain)));
        if (focusMemoryId) setSelectedNodeId(focusMemoryId);
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
  }, [workspaceId, focusMemoryId]);

  const selectedNode = useMemo(
    () => graph?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph, selectedNodeId],
  );

  const replayPath = useMemo(() => {
    if (!activeReplayTraceId || !graph) return [];
    const trace = graph.retrievalTraces.find(
      (t) => t.retrievalTraceId === activeReplayTraceId,
    );
    return trace?.rankingOrder ?? [];
  }, [activeReplayTraceId, graph]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSearchParams({ focus: nodeId }, { replace: true });
    },
    [setSearchParams],
  );

  const handleExpandNeighborhood = useCallback((nodeId: string) => {
    setExpandedNeighborhoods((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }, []);

  const handleEdgeHover = useCallback(
    (edge: RelationshipGraphEdge | null, position: { x: number; y: number } | null) => {
      setHoveredEdge(edge);
      setEdgeTooltipPos(position);
    },
    [],
  );

  const toggleDomain = (domain: string) => {
    setVisibleDomains((prev) => {
      const next = new Set(prev);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  };

  const toggleEdgeType = (type: MemoryRelationshipType) => {
    setVisibleEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="relmap-page flex h-[calc(100vh-var(--topbar-height))] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--color-border-default)] border-t-[var(--color-accent)]" />
          <p className="font-metric text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Initializing relationship graph…
          </p>
        </div>
      </div>
    );
  }

  if (error || !graph) {
    return (
      <div className="relmap-page flex h-[calc(100vh-var(--topbar-height))] items-center justify-center">
        <p className="font-metric text-sm text-[var(--color-danger)]">
          {error ?? "Failed to load relationship graph"}
        </p>
      </div>
    );
  }

  return (
    <div className="relmap-page -mx-8 -my-7 flex h-[calc(100vh-var(--topbar-height))] flex-col lg:-mx-10">
      {/* Header strip */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-5 py-2.5">
        <div className="flex items-center gap-4">
          <div>
            <span className="font-metric text-[0.5625rem] uppercase tracking-[0.1em] text-[var(--color-text-muted)]">
              CTX.OBSERVABILITY
            </span>
            <h1 className="text-sm font-semibold tracking-[-0.01em] text-[var(--color-text-primary)]">
              Contextual Relationship Map
            </h1>
          </div>
          <div className="hidden h-6 w-px bg-[var(--color-border-subtle)] sm:block" />
          <div className="hidden items-center gap-4 sm:flex">
            <StatPill label="Nodes" value={graph.stats.nodeCount} />
            <StatPill label="Edges" value={graph.stats.edgeCount} />
            <StatPill label="Clusters" value={graph.stats.clusterCount} />
            <StatPill
              label="Avg Confidence"
              value={`${(graph.stats.avgConfidence * 100).toFixed(1)}%`}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-accent)] opacity-30" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-accent)]" />
          </span>
          <span className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-accent)]">
            Live Graph
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left control panel */}
        <aside className="hidden w-52 shrink-0 flex-col border-r border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] lg:flex">
          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            <ControlSection title="Operational Domains" code="FLT.01">
              {graph.domains.map((domain, i) => (
                <label
                  key={domain.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-[var(--color-surface-2)]"
                >
                  <input
                    type="checkbox"
                    checked={visibleDomains.has(domain.domain)}
                    onChange={() => toggleDomain(domain.domain)}
                    className="accent-[var(--color-accent)]"
                  />
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: domainColor(i) }}
                  />
                  <span className="flex-1 truncate text-xs text-[var(--color-text-secondary)]">
                    {domain.label}
                  </span>
                  <span className="font-metric text-[0.5625rem] tabular-nums text-[var(--color-text-muted)]">
                    {domain.nodeCount}
                  </span>
                </label>
              ))}
            </ControlSection>

            <ControlSection title="Edge Types" code="FLT.02">
              {ALL_EDGE_TYPES.map((type) => {
                const colors = RELATIONSHIP_COLORS[type];
                return (
                  <label
                    key={type}
                    className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-[var(--color-surface-2)]"
                  >
                    <input
                      type="checkbox"
                      checked={visibleEdgeTypes.has(type)}
                      onChange={() => toggleEdgeType(type)}
                      className="accent-[var(--color-accent)]"
                    />
                    <span
                      className="h-0.5 w-3 rounded"
                      style={{ backgroundColor: colors.stroke }}
                    />
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {colors.label}
                    </span>
                  </label>
                );
              })}
            </ControlSection>

            <ControlSection title="Retrieval Replay" code="FLT.03">
              <RetrievalReplayOverlay
                traces={graph.retrievalTraces}
                activeTraceId={activeReplayTraceId}
                onSelectTrace={setActiveReplayTraceId}
                onReplayProgress={setReplayProgress}
                replayPath={replayPath}
              />
            </ControlSection>
          </div>
        </aside>

        {/* Center graph */}
        <main className="relative min-w-0 flex-1">
          <RelationshipCanvas
            nodes={graph.nodes}
            edges={graph.edges}
            selectedNodeId={selectedNodeId}
            hoveredEdgeId={hoveredEdge?.id ?? null}
            replayPath={replayPath}
            replayProgress={replayProgress}
            visibleDomains={visibleDomains}
            visibleEdgeTypes={visibleEdgeTypes}
            expandedNeighborhoods={expandedNeighborhoods}
            onNodeClick={handleNodeClick}
            onNodeHover={() => {}}
            onEdgeHover={handleEdgeHover}
          />
          <EdgeExplainability edge={hoveredEdge} position={edgeTooltipPos} />

          {/* Scan line overlay */}
          <div className="relmap-scanline pointer-events-none absolute inset-0 overflow-hidden opacity-[0.03]" />
        </main>

        {/* Right inspector */}
        <aside className="w-72 shrink-0 border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] xl:w-80">
          <NodeInspector
            node={selectedNode}
            edges={graph.edges}
            onExpandNeighborhood={handleExpandNeighborhood}
            isExpanded={selectedNodeId ? expandedNeighborhoods.has(selectedNodeId) : false}
          />
        </aside>
      </div>

      {/* Bottom timeline */}
      <div className="h-28 shrink-0">
        <OperationalTimeline
          events={graph.timelineEvents}
          scrubPosition={scrubPosition}
          onScrub={setScrubPosition}
          activeEventId={activeTimelineEvent?.id ?? null}
          onEventSelect={setActiveTimelineEvent}
        />
      </div>
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className="font-metric text-xs font-semibold tabular-nums text-[var(--color-text-primary)]">
        {value}
      </span>
    </div>
  );
}

function ControlSection({
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
      <header className="mb-2">
        <span className="font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
          {code}
        </span>
        <h3 className="text-xs font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </header>
      <div className="space-y-0.5">{children}</div>
    </section>
  );
}

export function RelationshipMapPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <RelationshipMapContent />
    </motion.div>
  );
}
