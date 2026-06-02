interface RelationshipAugmentationResult {
  neighborsExpanded: Array<{
    memoryId: string;
    relationshipType: string;
    confidence: number;
    generatedFrom: string[];
    inCandidateSet: boolean;
    rankingImpact: number;
  }>;
  rankingImpacts: Array<{
    memoryId: string;
    chunkId: string;
    previousScore: number;
    augmentedScore: number;
    relationshipType: string;
    confidence: number;
  }>;
  augmentationApplied: boolean;
  maxDepth: 1;
  neighborCount: number;
  confidenceThreshold: number;
  reasoning: string[];
}

interface RetrievalAugmentationViewerProps {
  augmentation?: RelationshipAugmentationResult;
  traceId?: string;
}

export function RetrievalAugmentationViewer({
  augmentation,
  traceId,
}: RetrievalAugmentationViewerProps) {
  if (!augmentation) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-4">
        <p className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          RETRIEVAL.AUGMENTATION
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
          No relationship augmentation recorded for this trace.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-4">
      <div className="flex items-center justify-between">
        <p className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
          RETRIEVAL.AUGMENTATION
        </p>
        <span
          className={`rounded px-2 py-0.5 text-xs ${
            augmentation.augmentationApplied
              ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
              : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
          }`}
        >
          {augmentation.augmentationApplied ? "APPLIED" : "NONE"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Depth" value={`${augmentation.maxDepth}`} />
        <Metric label="Neighbors" value={`${augmentation.neighborCount}`} />
        <Metric label="Threshold" value={augmentation.confidenceThreshold.toFixed(2)} />
      </div>

      {augmentation.rankingImpacts.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Ranking impacts (semantic-dominant nudge)
          </p>
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {augmentation.rankingImpacts.map((impact) => (
              <div
                key={`${impact.chunkId}-${impact.relationshipType}`}
                className="flex items-center justify-between rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs"
              >
                <span className="font-mono text-[var(--color-text-secondary)]">
                  {impact.memoryId.slice(0, 10)}…
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {impact.previousScore.toFixed(3)} → {impact.augmentedScore.toFixed(3)}
                </span>
                <span className="text-[var(--color-accent)]">
                  +{(impact.augmentedScore - impact.previousScore).toFixed(3)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {augmentation.neighborsExpanded.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Neighbor expansion
          </p>
          <div className="max-h-48 space-y-1 overflow-y-auto">
            {augmentation.neighborsExpanded.map((n) => (
              <div
                key={n.memoryId}
                className="flex items-center justify-between rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2 py-1.5 text-xs"
              >
                <span className="font-mono">{n.memoryId.slice(0, 12)}…</span>
                <span className="text-[var(--color-text-muted)]">{n.relationshipType}</span>
                <span>{n.confidence.toFixed(2)}</span>
                <span
                  className={
                    n.inCandidateSet
                      ? "text-[var(--color-accent)]"
                      : "text-[var(--color-text-muted)]"
                  }
                >
                  {n.inCandidateSet ? "ranked" : "suggested"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {augmentation.reasoning.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium text-[var(--color-text-secondary)]">
            Augmentation reasoning
          </p>
          <ul className="space-y-1 text-xs text-[var(--color-text-tertiary)]">
            {augmentation.reasoning.map((r, i) => (
              <li key={i} className="font-mono">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {traceId && (
        <p className="text-xs text-[var(--color-text-muted)]">
          Full trace: GET /augmentation/{traceId}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-2 text-center">
      <p className="font-metric text-[0.5625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 font-mono text-sm text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
