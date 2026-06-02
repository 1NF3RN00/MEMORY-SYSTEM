import { useEffect, useState } from "react";
import {
  emptyWorkspaceTelemetry,
  fetchWorkspaceTelemetry,
  type WorkspaceTelemetry,
} from "../../lib/workspaceTelemetry.js";

export function useOperationalHomeData() {
  const [telemetry, setTelemetry] = useState<WorkspaceTelemetry>(emptyWorkspaceTelemetry());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const data = await fetchWorkspaceTelemetry();
      if (cancelled) return;
      setTelemetry(data ?? emptyWorkspaceTelemetry());
      setLoading(false);
    }

    void load();
    const interval = window.setInterval(() => {
      void fetchWorkspaceTelemetry().then((data) => {
        if (!cancelled && data) setTelemetry(data);
      });
    }, 15_000);

    const onDataCleared = () => {
      void load();
    };
    window.addEventListener("mms:data-cleared", onDataCleared);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("mms:data-cleared", onDataCleared);
    };
  }, []);

  return {
    loading,
    indicators: telemetry.indicators,
    panelData: telemetry.panelData,
    events: telemetry.events,
  };
}
