interface NeighborhoodView {
  anchorMemoryId: string;
  workspaceId: string;
  nodes: Array<{
    memoryId: string;
    label: string;
    memoryType: string;
    domain: string;
    confidence: number;
    relationshipType: string;
    generatedFrom: string[];
    depth: number;
  }>;
  edges: Array<{
    source: string;
    target: string;
    relationshipType: string;
    confidence: number;
    weight: number;
    generatedFrom: string[];
  }>;
  semanticNeighborhood: string[];
  operationalCluster: string;
  reasoning: string[];
  generatedAt: string;
}

interface NeighborhoodViewerProps {
  neighborhood: NeighborhoodView | null;
  loading?: boolean;
}

export function NeighborhoodViewer({ neighborhood, loading }: NeighborhoodViewerProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-4">
        <p className="text-sm text-[var(--color-text-muted)]">Loading neighborhood…</p>
      </div>
    );
  }

  if (!neighborhood) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-3">
      <div className="flex items-center justify-between">
        <p className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          CONTEXTUAL.NEIGHBORHOOD
        </p>
        <span className="text-xs text-[var(--color-text-muted)]">
          depth=1 · {neighborhood.nodes.length} nodes
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-2">
          <p className="font-metric text-[0.5rem] uppercase text-[var(--color-text-muted)]">
            Operational cluster
          </p>
          <p className="mt-1 font-mono">{neighborhood.operationalCluster}</p>
        </div>
        <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-2">
          <p className="font-metric text-[0.5rem] uppercase text-[var(--color-text-muted)]">
            Semantic neighbors
          </p>
          <p className="mt-1 font-mono">{neighborhood.semanticNeighborhood.length}</p>
        </div>
      </div>

      {neighborhood.nodes.length > 0 && (
        <div className="max-h-32 space-y-1 overflow-y-auto">
          {neighborhood.nodes.map((node) => (
            <div
              key={node.memoryId}
              className="flex items-center justify-between rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2 py-1 text-xs"
            >
              <span className="font-mono">{node.label}</span>
              <span className="text-[var(--color-text-muted)]">{node.relationshipType}</span>
              <span>{node.confidence.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {neighborhood.reasoning.length > 0 && (
        <ul className="space-y-0.5 text-xs text-[var(--color-text-tertiary)]">
          {neighborhood.reasoning.slice(0, 4).map((r, i) => (
            <li key={i} className="font-mono truncate">
              {r}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
