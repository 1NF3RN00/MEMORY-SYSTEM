interface HistogramBucket {
  minScore: number;
  maxScore: number;
  count: number;
  acceptedCount?: number;
  rejectedCount?: number;
}

interface ScoreHistogramProps {
  buckets: HistogramBucket[];
  title?: string;
}

export function ScoreHistogram({ buckets, title }: ScoreHistogramProps) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] p-3">
      {title ? (
        <span className="font-metric text-[0.625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
          {title}
        </span>
      ) : null}
      <div className="mt-3 flex items-end gap-1" style={{ minHeight: "72px" }}>
        {buckets.map((bucket) => {
          const heightPct = (bucket.count / maxCount) * 100;
          const accepted = bucket.acceptedCount ?? 0;
          const rejected = bucket.rejectedCount ?? 0;
          const acceptedPct = bucket.count > 0 ? (accepted / bucket.count) * 100 : 0;

          return (
            <div
              key={`${bucket.minScore}-${bucket.maxScore}`}
              className="flex flex-1 flex-col items-center gap-1"
              title={`${bucket.minScore.toFixed(2)}–${bucket.maxScore.toFixed(2)}: ${bucket.count} (${accepted} accepted, ${rejected} rejected)`}
            >
              <div className="relative flex h-14 w-full items-end justify-center">
                <div
                  className="w-full max-w-[28px] rounded-t-sm bg-[var(--color-danger)]/40"
                  style={{ height: `${Math.max(4, heightPct)}%` }}
                />
                {accepted > 0 ? (
                  <div
                    className="absolute bottom-0 w-full max-w-[28px] rounded-t-sm bg-[var(--color-success)]/70"
                    style={{ height: `${Math.max(4, (heightPct * acceptedPct) / 100)}%` }}
                  />
                ) : null}
              </div>
              <span className="font-metric text-[0.5rem] text-[var(--color-text-muted)]">
                {bucket.minScore.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
