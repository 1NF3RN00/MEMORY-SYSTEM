import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPatch } from "../lib/api.js";
import { RangeField } from "./ui/RangeField.js";
import { Button } from "./ui/Button.js";

interface RetrievalRuntimeConfig {
  vector: {
    similarityThreshold: number;
  };
}

interface RetrievalConfigResponse {
  workspaceId: string;
  runtime: RetrievalRuntimeConfig;
  defaults: RetrievalRuntimeConfig;
}

const MODE_DELTAS: Record<string, number> = {
  precision: 0,
  expanded: -0.03,
  exploratory: -0.02,
  "incident-response": -0.01,
};

function effectiveThreshold(base: number, mode: string): number {
  const adjusted = base + (MODE_DELTAS[mode] ?? 0);
  return Math.max(0.45, Math.min(base, adjusted));
}

interface RetrievalThresholdPanelProps {
  workspaceId: string | null;
  compact?: boolean;
}

export function RetrievalThresholdPanel({ workspaceId, compact }: RetrievalThresholdPanelProps) {
  const [loaded, setLoaded] = useState<RetrievalConfigResponse | null>(null);
  const [threshold, setThreshold] = useState(0.55);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    setLoading(true);
    setError(null);
    apiGet<RetrievalConfigResponse>(`/retrieval/config?workspaceId=${workspaceId}`)
      .then((config) => {
        setLoaded(config);
        setThreshold(config.runtime.vector.similarityThreshold);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [workspaceId]);

  const dirty =
    loaded !== null && threshold !== loaded.runtime.vector.similarityThreshold;

  const modeThresholds = useMemo(
    () =>
      Object.entries(MODE_DELTAS).map(([mode, delta]) => ({
        mode,
        delta,
        value: effectiveThreshold(threshold, mode),
      })),
    [threshold],
  );

  async function handleSave() {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    setSavedMessage(null);
    try {
      const updated = await apiPatch<RetrievalConfigResponse>("/retrieval/config", {
        workspaceId,
        similarityThreshold: threshold,
      });
      setLoaded(updated);
      setThreshold(updated.runtime.vector.similarityThreshold);
      setSavedMessage("Threshold saved for this workspace.");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    if (!loaded) return;
    setThreshold(loaded.defaults.vector.similarityThreshold);
  }

  if (!workspaceId) {
    return (
      <p className="text-xs text-[var(--color-text-secondary)]">
        Load a workspace to configure retrieval thresholds.
      </p>
    );
  }

  if (loading && !loaded) {
    return <p className="text-xs text-[var(--color-text-secondary)]">Loading retrieval config…</p>;
  }

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <RangeField
        label="Base similarity threshold"
        value={threshold}
        onChange={setThreshold}
        min={0.45}
        max={0.95}
        step={0.01}
      />
      <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
        Chunks below this score are excluded from retrieval. On zero results, the pipeline
        automatically retries once at{" "}
        <span className="font-metric text-[var(--color-text-primary)]">
          max(0.45, threshold − 0.05)
        </span>
        . Near-miss rejections are reported per chunk in trace explainability.
      </p>

      {!compact && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {modeThresholds.map(({ mode, value, delta }) => (
            <div
              key={mode}
              className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-1)] px-3 py-2"
            >
              <span className="block font-metric text-[0.5625rem] uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                {mode.replace("-", " ")}
              </span>
              <span className="mt-1 block font-metric text-sm text-[var(--color-text-primary)]">
                {value.toFixed(2)}
              </span>
              <span className="block text-[0.625rem] text-[var(--color-text-tertiary)]">
                {delta === 0 ? "base" : `${delta.toFixed(2)} delta`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          disabled={!dirty || saving}
          loading={saving}
          onClick={() => void handleSave()}
        >
          Save threshold
        </Button>
        <button
          type="button"
          disabled={!loaded || saving}
          onClick={handleReset}
          className="font-metric text-[0.625rem] uppercase tracking-[0.04em] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
        >
          Reset to system default ({loaded?.defaults.vector.similarityThreshold.toFixed(2)})
        </button>
      </div>

      {savedMessage && (
        <p className="font-metric text-xs text-[var(--color-success)]">{savedMessage}</p>
      )}
      {error && <p className="font-metric text-xs text-[var(--color-danger)]">{error}</p>}
    </div>
  );
}
