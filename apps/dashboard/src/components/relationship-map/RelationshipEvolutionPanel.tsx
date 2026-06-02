interface RelationshipEvolutionEntry {
  timestamp: string;
  event: string;
  previousConfidence: number;
  newConfidence: number;
  previousWeight: number;
  newWeight: number;
  reason: string;
}

interface RelationshipEvolutionPanelProps {
  evolutionHistory: RelationshipEvolutionEntry[];
  confidence: number;
  reinforcementScore?: number;
  retrievalFrequency?: number;
}

export function RelationshipEvolutionPanel({
  evolutionHistory,
  confidence,
  reinforcementScore,
  retrievalFrequency,
}: RelationshipEvolutionPanelProps) {
  return (
    <div className="space-y-3 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-1)] p-3">
      <p className="font-metric text-[0.625rem] uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
        RELATIONSHIP.EVOLUTION
      </p>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Confidence" value={confidence.toFixed(2)} />
        <Stat label="Reinforcement" value={(reinforcementScore ?? 0).toFixed(2)} />
        <Stat label="Co-retrieval" value={String(retrievalFrequency ?? 0)} />
      </div>

      {evolutionHistory.length === 0 ? (
        <p className="text-xs text-[var(--color-text-tertiary)]">No evolution history recorded.</p>
      ) : (
        <div className="max-h-36 space-y-1.5 overflow-y-auto">
          {[...evolutionHistory].reverse().map((entry, i) => (
            <div
              key={`${entry.timestamp}-${i}`}
              className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] px-2 py-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-metric uppercase text-[var(--color-accent)]">
                  {entry.event}
                </span>
                <span className="text-[var(--color-text-muted)]">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                conf {entry.previousConfidence.toFixed(2)} → {entry.newConfidence.toFixed(2)}
                {" · "}
                w {entry.previousWeight.toFixed(2)} → {entry.newWeight.toFixed(2)}
              </p>
              <p className="text-xs text-[var(--color-text-tertiary)]">{entry.reason}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--color-border-subtle)] bg-[var(--color-surface-2)] p-1.5 text-center">
      <p className="font-metric text-[0.5rem] uppercase text-[var(--color-text-muted)]">{label}</p>
      <p className="font-mono text-xs">{value}</p>
    </div>
  );
}
