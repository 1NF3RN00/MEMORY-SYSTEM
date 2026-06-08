import {
  ContextualIntelligenceMap,
  LiveOperationalStream,
  OperationalIntelligencePanels,
  OperationalSystemBar,
  useOperationalHomeData,
} from "../components/homepage/index.js";

export function HomePage() {
  const {
    loading,
    indicators,
    panelData,
    events,
    analyticsLoaded,
    analyticsLoading,
    requestAnalytics,
  } = useOperationalHomeData();

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[var(--color-void)]">
      <OperationalSystemBar indicators={indicators} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr_minmax(240px,300px)] lg:grid-rows-1">
        <div className="min-h-[420px] min-w-0 lg:col-start-2 lg:row-start-1 lg:min-h-0">
          <ContextualIntelligenceMap telemetryReady={!loading} />
        </div>

        <div className="grid max-h-[40vh] grid-cols-1 border-t border-[var(--color-border-subtle)] sm:grid-cols-2 lg:contents">
          <div className="min-h-0 lg:col-start-1 lg:row-start-1 lg:max-h-none">
            <LiveOperationalStream events={events} loading={loading} />
          </div>

          <div className="min-h-0 lg:col-start-3 lg:row-start-1 lg:max-h-none">
            <OperationalIntelligencePanels
              data={panelData}
              loading={loading}
              analyticsLoaded={analyticsLoaded}
              analyticsLoading={analyticsLoading}
              onRequestAnalytics={requestAnalytics}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
