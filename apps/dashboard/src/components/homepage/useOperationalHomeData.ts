import { useMemo } from "react";
import {
  useTelemetryAnalyticsState,
  useTelemetryEvents,
  useTelemetryIndicators,
  useTelemetryPanelData,
} from "../../context/WorkspaceTelemetryContext.js";

export function useOperationalHomeData() {
  const { indicators, loading: indicatorsLoading } = useTelemetryIndicators();
  const { panelData, loading: panelLoading } = useTelemetryPanelData();
  const { events, loading: eventsLoading } = useTelemetryEvents();
  const { analyticsLoaded, analyticsLoading, requestAnalytics } = useTelemetryAnalyticsState();

  const loading = indicatorsLoading || panelLoading || eventsLoading;

  return useMemo(
    () => ({
      loading,
      indicators,
      panelData,
      events,
      analyticsLoaded,
      analyticsLoading,
      requestAnalytics,
    }),
    [
      loading,
      indicators,
      panelData,
      events,
      analyticsLoaded,
      analyticsLoading,
      requestAnalytics,
    ],
  );
}
