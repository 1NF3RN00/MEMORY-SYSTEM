import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationNodeDatum,
} from "d3-force";
import type {
  RelationshipGraphEdge,
  RelationshipGraphNode,
  SimNode,
} from "./types.js";
import { RELATIONSHIP_COLORS, domainColor } from "./constants.js";

interface RelationshipCanvasProps {
  nodes: RelationshipGraphNode[];
  edges: RelationshipGraphEdge[];
  selectedNodeId: string | null;
  hoveredEdgeId: string | null;
  replayPath: string[];
  replayProgress: number;
  visibleDomains: Set<string>;
  visibleEdgeTypes: Set<string>;
  expandedNeighborhoods: Set<string>;
  onNodeClick: (nodeId: string) => void;
  onNodeHover: (nodeId: string | null) => void;
  onEdgeHover: (edge: RelationshipGraphEdge | null, position: { x: number; y: number } | null) => void;
}

interface InternalLink {
  source: SimNode;
  target: SimNode;
  edge: RelationshipGraphEdge;
}

function nodeRadius(node: RelationshipGraphNode): number {
  const base = 8;
  const accessBoost = Math.min(12, Math.log2(node.accessCount + 1) * 3);
  const densityBoost = node.semanticDensity * 6;
  return base + accessBoost + densityBoost;
}

export function RelationshipCanvas({
  nodes,
  edges,
  selectedNodeId,
  hoveredEdgeId,
  replayPath,
  replayProgress,
  visibleDomains,
  visibleEdgeTypes,
  expandedNeighborhoods,
  onNodeClick,
  onNodeHover,
  onEdgeHover,
}: RelationshipCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<InternalLink[]>([]);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const draggingRef = useRef<{ nodeId: string | null; panning: boolean; lastX: number; lastY: number }>({
    nodeId: null,
    panning: false,
    lastX: 0,
    lastY: 0,
  });
  const animationRef = useRef<number>(0);
  const replayPhaseRef = useRef(0);

  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  const filteredNodes = useMemo(
    () => nodes.filter((n) => visibleDomains.has(n.domain)),
    [nodes, visibleDomains],
  );
  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const filteredEdges = useMemo(
    () =>
      edges.filter(
        (e) =>
          visibleEdgeTypes.has(e.relationshipType) &&
          filteredNodeIds.has(e.source) &&
          filteredNodeIds.has(e.target) &&
          (e.source !== e.target ||
            expandedNeighborhoods.has(e.source) ||
            expandedNeighborhoods.has(e.target)),
      ),
    [edges, visibleEdgeTypes, filteredNodeIds, expandedNeighborhoods],
  );

  const domainIndexMap = useRef(new Map<string, number>());

  useEffect(() => {
    const domains = [...new Set(filteredNodes.map((n) => n.domain))];
    domainIndexMap.current = new Map(domains.map((d, i) => [d, i]));
  }, [filteredNodes]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const { width, height } = dimensions;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const { x: tx, y: ty, scale } = transformRef.current;
    const simNodes = simNodesRef.current;
    const simLinks = simLinksRef.current;

    ctx.clearRect(0, 0, width, height);

    // Grid background
    ctx.save();
    ctx.fillStyle = "#050506";
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = "rgba(255,255,255,0.025)";
    ctx.lineWidth = 1;
    const gridSize = 40 * scale;
    const offsetX = tx % gridSize;
    const offsetY = ty % gridSize;
    for (let gx = offsetX; gx < width; gx += gridSize) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }
    for (let gy = offsetY; gy < height; gy += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();
    }

    // Radial vignette
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      0,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.7,
    );
    gradient.addColorStop(0, "rgba(56,189,248,0.02)");
    gradient.addColorStop(1, "rgba(0,0,0,0.4)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    ctx.save();
    ctx.translate(tx, ty);
    ctx.scale(scale, scale);

    // Domain cluster halos
    const clusterCenters = new Map<string, { x: number; y: number; count: number; radius: number }>();
    for (const node of simNodes) {
      const existing = clusterCenters.get(node.domain);
      if (!existing) {
        clusterCenters.set(node.domain, {
          x: node.x ?? 0,
          y: node.y ?? 0,
          count: 1,
          radius: nodeRadius(node),
        });
      } else {
        existing.x = (existing.x * existing.count + (node.x ?? 0)) / (existing.count + 1);
        existing.y = (existing.y * existing.count + (node.y ?? 0)) / (existing.count + 1);
        existing.count += 1;
        existing.radius = Math.max(existing.radius, nodeRadius(node));
      }
    }

    for (const [domain, center] of clusterCenters) {
      const idx = domainIndexMap.current.get(domain) ?? 0;
      const color = domainColor(idx);
      const haloRadius = center.radius + 40 + center.count * 8;
      const haloGrad = ctx.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        haloRadius,
      );
      haloGrad.addColorStop(0, color.replace(")", ", 0.06)").replace("rgb", "rgba").replace("#", "") || `${color}10`);
      ctx.beginPath();
      ctx.arc(center.x, center.y, haloRadius, 0, Math.PI * 2);
      ctx.fillStyle = `${color}08`;
      ctx.fill();
      ctx.strokeStyle = `${color}15`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Edges
    for (const link of simLinks) {
      const source = link.source as SimNode;
      const target = link.target as SimNode;
      if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

      const edge = link.edge;
      const relType = edge.relationshipType as keyof typeof RELATIONSHIP_COLORS;
      const colors = RELATIONSHIP_COLORS[relType] ?? RELATIONSHIP_COLORS.co_retrieval;
      const isHovered = hoveredEdgeId === edge.id;
      const lineWidth = 0.5 + edge.weight * 3 + (isHovered ? 2 : 0);
      const alpha = isHovered ? 1 : 0.35 + edge.confidence * 0.45;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);

      ctx.shadowColor = colors.glow;
      ctx.shadowBlur = isHovered ? 16 : 4 + edge.weight * 8;
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    }

    // Replay path animation
    if (replayPath.length > 1) {
      replayPhaseRef.current = (replayPhaseRef.current + 0.02) % 1;
      const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
      const pathNodes = replayPath.map((id) => nodeMap.get(id)).filter(Boolean) as SimNode[];

      if (pathNodes.length > 1) {
        const visibleCount = Math.max(2, Math.floor(pathNodes.length * replayProgress));

        ctx.beginPath();
        ctx.setLineDash([6, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#38bdf8";
        ctx.shadowColor = "rgba(56,189,248,0.8)";
        ctx.shadowBlur = 12;

        for (let i = 0; i < visibleCount - 1; i++) {
          const a = pathNodes[i]!;
          const b = pathNodes[i + 1]!;
          if (a.x == null || a.y == null || b.x == null || b.y == null) continue;
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Animated pulse along path
        const totalSegments = visibleCount - 1;
        if (totalSegments > 0) {
          const segProgress = replayPhaseRef.current * totalSegments;
          const segIdx = Math.floor(segProgress);
          const segT = segProgress - segIdx;
          const a = pathNodes[Math.min(segIdx, pathNodes.length - 2)]!;
          const b = pathNodes[Math.min(segIdx + 1, pathNodes.length - 1)]!;
          if (a.x != null && a.y != null && b.x != null && b.y != null) {
            const px = a.x + (b.x - a.x) * segT;
            const py = a.y + (b.y - a.y) * segT;
            ctx.beginPath();
            ctx.arc(px, py, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#38bdf8";
            ctx.shadowBlur = 20;
            ctx.fill();
          }
        }
        ctx.shadowBlur = 0;
      }
    }

    // Nodes
    for (const node of simNodes) {
      if (node.x == null || node.y == null) continue;
      const r = nodeRadius(node);
      const idx = domainIndexMap.current.get(node.domain) ?? 0;
      const color = domainColor(idx);
      const isSelected = selectedNodeId === node.id;
      const isExpanded = expandedNeighborhoods.has(node.id);

      // Outer glow ring
      if (isSelected || isExpanded) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected ? "#38bdf8" : `${color}60`;
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.shadowColor = isSelected ? "rgba(56,189,248,0.6)" : `${color}40`;
        ctx.shadowBlur = isSelected ? 16 : 8;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Node body
      const nodeGrad = ctx.createRadialGradient(
        node.x - r * 0.3,
        node.y - r * 0.3,
        0,
        node.x,
        node.y,
        r,
      );
      nodeGrad.addColorStop(0, "#232328");
      nodeGrad.addColorStop(0.7, "#111113");
      nodeGrad.addColorStop(1, "#0a0a0b");

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeGrad;
      ctx.fill();
      ctx.strokeStyle = `${color}${isSelected ? "ff" : "80"}`;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Access count indicator
      if (node.accessCount > 0) {
        ctx.beginPath();
        ctx.arc(node.x + r * 0.7, node.y - r * 0.7, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#4ade80";
        ctx.fill();
      }

      // Label
      ctx.font = "500 9px 'IBM Plex Mono', monospace";
      ctx.fillStyle = "rgba(250,250,250,0.85)";
      ctx.textAlign = "center";
      ctx.fillText(
        node.label.length > 14 ? `${node.label.slice(0, 12)}…` : node.label,
        node.x,
        node.y + r + 12,
      );
    }

    ctx.restore();
  }, [
    dimensions,
    selectedNodeId,
    hoveredEdgeId,
    replayPath,
    replayProgress,
    expandedNeighborhoods,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const { width, height } = dimensions;
    if (width === 0 || height === 0) return;

    simNodesRef.current = filteredNodes.map((n, i) => {
      const angle = (i / filteredNodes.length) * Math.PI * 2;
      const radius = Math.min(width, height) * 0.25;
      return {
        ...n,
        x: width / 2 + Math.cos(angle) * radius,
        y: height / 2 + Math.sin(angle) * radius,
      };
    });

    const nodeById = new Map(simNodesRef.current.map((n) => [n.id, n]));

    simLinksRef.current = filteredEdges.flatMap((e) => {
      const source = nodeById.get(e.source);
      const target = nodeById.get(e.target);
      if (!source || !target) return [];
      return [{ source, target, edge: e }];
    });

    const simulation = forceSimulation(simNodesRef.current)
      .force(
        "link",
        forceLink<SimNode, InternalLink>(simLinksRef.current)
          .id((d) => d.id)
          .distance((l) => 80 + (1 - l.edge.weight) * 60)
          .strength((l) => l.edge.weight * 0.4),
      )
      .force("charge", forceManyBody<SimNode>().strength(-120))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => nodeRadius(d) + 16),
      );

    simulation.on("tick", () => {
      draw();
    });

    transformRef.current = { x: 0, y: 0, scale: 1 };

    return () => {
      simulation.stop();
    };
  }, [filteredNodes, filteredEdges, dimensions, draw]);

  useEffect(() => {
    const loop = () => {
      if (replayPath.length > 1) draw();
      animationRef.current = requestAnimationFrame(loop);
    };
    animationRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationRef.current);
  }, [draw, replayPath.length]);

  const screenToWorld = useCallback(
    (screenX: number, screenY: number) => {
      const { x, y, scale } = transformRef.current;
      return {
        x: (screenX - x) / scale,
        y: (screenY - y) / scale,
      };
    },
    [],
  );

  const findNodeAt = useCallback(
    (worldX: number, worldY: number): SimNode | null => {
      for (const node of simNodesRef.current) {
        if (node.x == null || node.y == null) continue;
        const r = nodeRadius(node);
        const dx = worldX - node.x;
        const dy = worldY - node.y;
        if (dx * dx + dy * dy <= r * r) return node;
      }
      return null;
    },
    [],
  );

  const findEdgeAt = useCallback(
    (worldX: number, worldY: number): InternalLink | null => {
      let closest: InternalLink | null = null;
      let closestDist = 12;

      for (const link of simLinksRef.current) {
        const source = link.source as SimNode;
        const target = link.target as SimNode;
        if (source.x == null || source.y == null || target.x == null || target.y == null) continue;

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len === 0) continue;

        const t = Math.max(
          0,
          Math.min(1, ((worldX - source.x) * dx + (worldY - source.y) * dy) / (len * len)),
        );
        const projX = source.x + t * dx;
        const projY = source.y + t * dy;
        const dist = Math.sqrt((worldX - projX) ** 2 + (worldY - projY) ** 2);

        if (dist < closestDist) {
          closestDist = dist;
          closest = link;
        }
      }
      return closest;
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);
      const node = findNodeAt(world.x, world.y);

      draggingRef.current = {
        nodeId: node?.id ?? null,
        panning: !node,
        lastX: e.clientX,
        lastY: e.clientY,
      };

      if (node) {
        node.fx = node.x;
        node.fy = node.y;
        onNodeClick(node.id);
      }

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [screenToWorld, findNodeAt, onNodeClick],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy);
      const drag = draggingRef.current;

      if (drag.nodeId) {
        const node = simNodesRef.current.find((n) => n.id === drag.nodeId);
        if (node) {
          node.fx = world.x;
          node.fy = world.y;
        }
      } else if (drag.panning && e.buttons === 1) {
        const dx = e.clientX - drag.lastX;
        const dy = e.clientY - drag.lastY;
        transformRef.current.x += dx;
        transformRef.current.y += dy;
        drag.lastX = e.clientX;
        drag.lastY = e.clientY;
        draw();
      } else {
        const edge = findEdgeAt(world.x, world.y);
        if (edge) {
          onEdgeHover(edge.edge, { x: e.clientX, y: e.clientY });
        } else {
          onEdgeHover(null, null);
        }
        const node = findNodeAt(world.x, world.y);
        onNodeHover(node?.id ?? null);
      }
    },
    [screenToWorld, findEdgeAt, findNodeAt, onEdgeHover, onNodeHover, draw],
  );

  const handlePointerUp = useCallback(() => {
    if (draggingRef.current.nodeId) {
      const node = simNodesRef.current.find((n) => n.id === draggingRef.current.nodeId);
      if (node) {
        node.fx = null;
        node.fy = null;
      }
    }
    draggingRef.current = { nodeId: null, panning: false, lastX: 0, lastY: 0 };
  }, []);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = Math.min(3, Math.max(0.3, transformRef.current.scale * factor));

      transformRef.current.x = sx - (sx - transformRef.current.x) * (newScale / transformRef.current.scale);
      transformRef.current.y = sy - (sy - transformRef.current.y) * (newScale / transformRef.current.scale);
      transformRef.current.scale = newScale;
      draw();
    },
    [draw],
  );

  return (
    <div ref={containerRef} className="relmap-canvas-container relative h-full w-full overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[rgba(56,189,248,0.3)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[rgba(56,189,248,0.15)] to-transparent" />
    </div>
  );
}
