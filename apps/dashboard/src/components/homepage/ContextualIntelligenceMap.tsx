import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";
import { useAuth } from "../../context/AuthContext.js";
import { apiGet } from "../../lib/api.js";
import type { MemoryGraphLink, MemoryGraphNode } from "./types.js";

interface SimNode extends Omit<MemoryGraphNode, "x" | "y">, SimulationNodeDatum {}

interface InternalLink {
  source: SimNode;
  target: SimNode;
  edge: MemoryGraphLink;
}

interface Particle {
  linkIndex: number;
  progress: number;
  speed: number;
}

const DOMAIN_COLORS: Record<string, string> = {
  strategic: "rgba(56, 189, 248, 0.85)",
  research: "rgba(103, 232, 249, 0.75)",
  product: "rgba(161, 161, 170, 0.7)",
  operational: "rgba(113, 113, 122, 0.7)",
  compliance: "rgba(82, 82, 91, 0.65)",
  technical: "rgba(56, 189, 248, 0.6)",
  assembly: "rgba(56, 189, 248, 1)",
  historian: "rgba(82, 82, 91, 0.55)",
  default: "rgba(161, 161, 170, 0.7)",
};

function nodeRadius(node: Pick<MemoryGraphNode, "accessWeight">): number {
  return 5 + node.accessWeight * 8;
}

function mapGraphFromApi(data: {
  nodes: Array<{
    id: string;
    label: string;
    domain: string;
    accessCount: number;
    retrievalEligible: boolean;
  }>;
  edges: Array<{ source: string; target: string; weight: number }>;
}): { nodes: MemoryGraphNode[]; links: MemoryGraphLink[] } {
  const nodes = data.nodes.slice(0, 24).map((node) => ({
    id: node.id,
    label: node.label.slice(0, 18),
    domain: node.domain,
    state: node.retrievalEligible ? ("idle" as const) : ("rejected" as const),
    accessWeight: Math.min(1, node.accessCount / 20),
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));
  const links = data.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .slice(0, 40)
    .map((edge) => ({
      source: edge.source,
      target: edge.target,
      strength: edge.weight,
      active: false,
    }));

  return { nodes, links };
}

const SKELETON_NODES = [
  { left: "18%", top: "28%", size: 10 },
  { left: "42%", top: "22%", size: 8 },
  { left: "68%", top: "35%", size: 12 },
  { left: "32%", top: "52%", size: 9 },
  { left: "58%", top: "58%", size: 11 },
  { left: "24%", top: "68%", size: 7 },
  { left: "72%", top: "62%", size: 9 },
] as const;

function GraphLoadingSkeleton() {
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-5 px-6"
      aria-busy="true"
      aria-label="Loading relationship graph"
    >
      <div className="relative h-56 w-full max-w-lg">
        <div className="absolute inset-0 rounded-lg border border-[var(--color-border-subtle)] bg-[rgba(255,255,255,0.01)]" />
        {SKELETON_NODES.map((node, index) => (
          <span
            key={index}
            className="absolute animate-pulse rounded-full bg-[rgba(56,189,248,0.18)]"
            style={{
              left: node.left,
              top: node.top,
              width: node.size,
              height: node.size,
              animationDelay: `${index * 120}ms`,
            }}
          />
        ))}
        <svg className="absolute inset-0 h-full w-full text-[rgba(255,255,255,0.04)]" aria-hidden="true">
          <line x1="22%" y1="32%" x2="46%" y2="26%" stroke="currentColor" strokeWidth="1" />
          <line x1="46%" y1="26%" x2="70%" y2="38%" stroke="currentColor" strokeWidth="1" />
          <line x1="36%" y1="56%" x2="60%" y2="62%" stroke="currentColor" strokeWidth="1" />
          <line x1="28%" y1="72%" x2="60%" y2="62%" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
      <p className="text-[0.75rem] text-[var(--color-text-muted)]">Loading relationship graph…</p>
    </div>
  );
}

interface ContextualIntelligenceMapProps {
  /** When true, home telemetry has finished — graph may load after map is visible. */
  telemetryReady?: boolean;
}

export function ContextualIntelligenceMap({ telemetryReady = false }: ContextualIntelligenceMapProps) {
  const { workspaceId, loading: authLoading } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphFetchStartedRef = useRef(false);
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<InternalLink[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number>(0);
  const phaseRef = useRef(0);
  const retrievalWaveRef = useRef<{ activeIds: Set<string>; linkIndices: Set<number>; startTime: number } | null>(
    null,
  );
  const phaseLabelRef = useRef("Context assembly idle");
  const phaseLabelElementRef = useRef<HTMLSpanElement>(null);
  const waveExpiredRef = useRef(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [graphNodes, setGraphNodes] = useState<MemoryGraphNode[]>([]);
  const [graphLinks, setGraphLinks] = useState<MemoryGraphLink[]>([]);
  const [mapInView, setMapInView] = useState(false);
  const [graphStatus, setGraphStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");
  const hubIdRef = useRef<string | null>(null);
  const graphLoading = graphStatus === "loading" || graphStatus === "idle";

  const updatePhaseLabel = useCallback((label: string) => {
    if (phaseLabelRef.current === label) return;
    phaseLabelRef.current = label;
    if (phaseLabelElementRef.current) {
      phaseLabelElementRef.current.textContent = label;
    }
  }, []);

  const triggerRetrievalWave = useCallback(() => {
    const hubId = hubIdRef.current;
    if (!hubId) return;

    const activeIds = new Set<string>([hubId]);
    const linkIndices = new Set<number>();

    simLinksRef.current.forEach((link, i) => {
      if (link.source.id === hubId || link.target.id === hubId) {
        linkIndices.add(i);
        activeIds.add(link.source.id);
        activeIds.add(link.target.id);
      }
    });

    simNodesRef.current.forEach((node) => {
      if (activeIds.has(node.id)) {
        node.state = node.state === "rejected" ? "rejected" : "active";
      } else if (node.state !== "rejected") {
        node.state = "idle";
      }
    });

    particlesRef.current = [...linkIndices].map((linkIndex) => ({
      linkIndex,
      progress: Math.random() * 0.3,
      speed: 0.004 + Math.random() * 0.003,
    }));

    retrievalWaveRef.current = { activeIds, linkIndices, startTime: performance.now() };
    waveExpiredRef.current = false;
    updatePhaseLabel("Retrieval pathway forming");
  }, [updatePhaseLabel]);

  const triggerCompression = useCallback(() => {
    const sorted = [...simNodesRef.current]
      .filter((node) => node.state !== "rejected")
      .sort((a, b) => b.accessWeight - a.accessWeight);
    const targets = sorted.slice(1, 4).map((node) => node.id);
    simNodesRef.current.forEach((node) => {
      if (targets.includes(node.id)) node.state = "compressed";
    });
    updatePhaseLabel("Compression merge active");
    window.setTimeout(() => {
      simNodesRef.current.forEach((node) => {
        if (node.state === "compressed") node.state = "active";
      });
      updatePhaseLabel("Context window stabilized");
    }, 2400);
  }, [updatePhaseLabel]);

  useEffect(() => {
    graphFetchStartedRef.current = false;
    setMapInView(false);
    setGraphStatus("idle");
    setGraphNodes([]);
    setGraphLinks([]);
    hubIdRef.current = null;
  }, [workspaceId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setMapInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: "80px 0px", threshold: 0.01 },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (authLoading || !workspaceId) return;
    if (!mapInView || !telemetryReady) return;
    if (graphFetchStartedRef.current) return;

    graphFetchStartedRef.current = true;
    let cancelled = false;
    setGraphStatus("loading");

    async function loadGraph() {
      try {
        const graph = await apiGet<{
          nodes: Array<{
            id: string;
            label: string;
            domain: string;
            accessCount: number;
            retrievalEligible: boolean;
          }>;
          edges: Array<{ source: string; target: string; weight: number }>;
        }>(`/relationships/graph?workspaceId=${workspaceId}&lite=true`);

        if (cancelled) return;
        const mapped = mapGraphFromApi(graph);
        setGraphNodes(mapped.nodes);
        setGraphLinks(mapped.links);
        hubIdRef.current =
          mapped.nodes.reduce<MemoryGraphNode | null>(
            (best, node) => (!best || node.accessWeight > best.accessWeight ? node : best),
            null,
          )?.id ?? null;
        setGraphStatus(mapped.nodes.length > 0 ? "ready" : "empty");
      } catch {
        if (!cancelled) {
          setGraphNodes([]);
          setGraphLinks([]);
          hubIdRef.current = null;
          setGraphStatus("empty");
        }
      }
    }

    void loadGraph();
    return () => {
      cancelled = true;
    };
  }, [authLoading, workspaceId, mapInView, telemetryReady]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry?.contentRect ?? { width: 800, height: 600 };
      setDimensions({ width: Math.max(width, 320), height: Math.max(height, 400) });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (graphNodes.length === 0) return;

    const { width, height } = dimensions;
    const simNodes: SimNode[] = graphNodes.map((n) => ({ ...n }));
    const nodeById = new Map(simNodes.map((n) => [n.id, n]));

    const simLinks: InternalLink[] = graphLinks
      .map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) return null;
        return { source, target, edge };
      })
      .filter((link): link is InternalLink => link !== null);

    simNodesRef.current = simNodes;
    simLinksRef.current = simLinks;

    const simulation = forceSimulation(simNodes)
      .force(
        "link",
        forceLink(simLinks)
          .id((d) => (d as SimNode).id)
          .distance(90)
          .strength(0.35),
      )
      .force("charge", forceManyBody().strength(-120))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => nodeRadius(d) + 14),
      )
      .alpha(0.8)
      .alphaDecay(0.02);

    return () => {
      simulation.stop();
    };
  }, [dimensions, graphNodes, graphLinks]);

  useEffect(() => {
    if (graphNodes.length === 0) return;

    let waveTimer: number;
    let compressTimer: number;

    const scheduleWave = () => {
      triggerRetrievalWave();
      waveTimer = window.setTimeout(scheduleWave, 4800);
    };

    waveTimer = window.setTimeout(scheduleWave, 800);
    compressTimer = window.setInterval(triggerCompression, 12000);

    return () => {
      window.clearTimeout(waveTimer);
      window.clearInterval(compressTimer);
    };
  }, [triggerRetrievalWave, triggerCompression, graphNodes.length]);

  useEffect(() => {
    if (graphNodes.length === 0) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const { width, height } = dimensions;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = "#0c0c0e";
      ctx.fillRect(0, 0, width, height);

      const gridStep = 40;
      ctx.strokeStyle = "rgba(255,255,255,0.015)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      phaseRef.current += 0.012;
      const wave = retrievalWaveRef.current;
      const waveAge = wave ? (performance.now() - wave.startTime) / 1000 : 999;

      if (wave && waveAge > 3.5 && !waveExpiredRef.current) {
        waveExpiredRef.current = true;
        retrievalWaveRef.current = null;
        simNodesRef.current.forEach((node) => {
          if (node.state === "active") node.state = "idle";
        });
        particlesRef.current = [];
        updatePhaseLabel("Context assembly idle");
      }

      const simLinks = simLinksRef.current;
      simLinks.forEach((link, i) => {
        const sx = link.source.x ?? 0;
        const sy = link.source.y ?? 0;
        const tx = link.target.x ?? 0;
        const ty = link.target.y ?? 0;
        const isActive = wave?.linkIndices.has(i);

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(tx, ty);
        ctx.strokeStyle = isActive
          ? `rgba(56, 189, 248, ${0.15 + Math.sin(phaseRef.current + i) * 0.08})`
          : "rgba(255,255,255,0.04)";
        ctx.lineWidth = isActive ? 0.8 : 0.4;
        ctx.stroke();

        if (isActive) {
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(tx, ty);
          ctx.strokeStyle = "rgba(56, 189, 248, 0.04)";
          ctx.lineWidth = 3;
          ctx.stroke();
        }
      });

      particlesRef.current.forEach((particle) => {
        particle.progress += particle.speed;
        if (particle.progress > 1) particle.progress = 0;

        const link = simLinks[particle.linkIndex];
        if (!link) return;

        const sx = link.source.x ?? 0;
        const sy = link.source.y ?? 0;
        const tx = link.target.x ?? 0;
        const ty = link.target.y ?? 0;
        const px = sx + (tx - sx) * particle.progress;
        const py = sy + (ty - sy) * particle.progress;

        ctx.beginPath();
        ctx.arc(px, py, 1.2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(103, 232, 249, 0.9)";
        ctx.fill();
      });

      simNodesRef.current.forEach((node) => {
        const x = node.x ?? 0;
        const y = node.y ?? 0;
        const r = nodeRadius(node);
        const isActive = node.state === "active";
        const isRejected = node.state === "rejected";
        const isCompressed = node.state === "compressed";
        const baseColor = DOMAIN_COLORS[node.domain] ?? DOMAIN_COLORS.default!;
        const isHub = node.id === hubIdRef.current;

        if (isActive || isHub) {
          const pulse = 0.3 + Math.sin(phaseRef.current * 2 + r) * 0.15;
          const glowR = r + 12 + pulse * 8;
          const gradient = ctx.createRadialGradient(x, y, r * 0.5, x, y, glowR);
          gradient.addColorStop(0, "rgba(56, 189, 248, 0.12)");
          gradient.addColorStop(1, "rgba(56, 189, 248, 0)");
          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(x, y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = isRejected
          ? "rgba(82, 82, 91, 0.35)"
          : isCompressed
            ? "rgba(56, 189, 248, 0.5)"
            : baseColor.replace(/[\d.]+\)$/, isActive ? "0.95)" : "0.55)");
        ctx.fill();

        ctx.strokeStyle = isActive
          ? "rgba(103, 232, 249, 0.6)"
          : "rgba(255,255,255,0.08)";
        ctx.lineWidth = isActive ? 1 : 0.5;
        ctx.stroke();

        ctx.fillStyle = isRejected
          ? "rgba(113, 113, 122, 0.5)"
          : "rgba(250, 250, 250, 0.75)";
        ctx.font = "500 9px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(node.label, x, y + r + 11);
      });

      animationRef.current = requestAnimationFrame(draw);
    };

    animationRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animationRef.current);
  }, [dimensions, updatePhaseLabel, graphNodes.length]);

  return (
    <section className="relative flex h-full min-h-0 flex-col bg-[#0c0c0e]">
      <header className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between px-5 py-4">
        <div>
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-primary)]">
            Contextual Intelligence Map
          </h2>
          <p className="mt-0.5 font-metric text-[0.5rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
            Live memory orchestration
          </p>
        </div>
        <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-0)] px-3 py-1.5">
          <span
            ref={phaseLabelElementRef}
            className="font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-accent)]"
          >
            Context assembly idle
          </span>
        </div>
      </header>

      <div ref={containerRef} className="relative min-h-0 flex-1">
        {graphLoading ? (
          <GraphLoadingSkeleton />
        ) : graphNodes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-[0.875rem] text-[var(--color-text-secondary)]">
              No indexed memory relationships yet.
            </p>
            <Link to="/ingest" className="text-[0.8125rem] text-[var(--color-accent)] no-underline hover:underline">
              Ingest memories to build the intelligence map
            </Link>
          </div>
        ) : (
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#0c0c0e] to-transparent" />
      </div>

      <footer className="flex shrink-0 items-center justify-between border-t border-[var(--color-border-subtle)] px-5 py-2">
        <div className="flex gap-4">
          {[
            { label: "Active", color: "bg-[var(--color-accent)]" },
            { label: "Rejected", color: "bg-[var(--color-text-muted)]" },
            { label: "Compressed", color: "bg-[#67e8f9]" },
          ].map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className={`h-1 w-1 rounded-full ${item.color}`} />
              <span className="font-metric text-[0.5rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                {item.label}
              </span>
            </span>
          ))}
        </div>
        <span className="font-metric text-[0.5rem] tabular-nums text-[var(--color-text-muted)]">
          {graphNodes.length} nodes · {graphLinks.length} pathways
        </span>
      </footer>
    </section>
  );
}
