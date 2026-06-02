import {
  ContextualIntelligenceMap,
  LiveOperationalStream,
  OperationalIntelligencePanels,
  OperationalSystemBar,
  useOperationalHomeData,
} from "../components/homepage/index.js";

export function HomePage() {
  const { loading, indicators, panelData, events } = useOperationalHomeData();

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[var(--color-void)]">
      <OperationalSystemBar indicators={indicators} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(240px,280px)_1fr_minmax(240px,300px)]">
        <div className="hidden min-h-0 lg:block">
          <LiveOperationalStream events={events} loading={loading} />
        </div>

        <div className="min-h-[420px] min-w-0 lg:min-h-0">
          <ContextualIntelligenceMap />
        </div>

        <div className="hidden min-h-0 lg:block">
          <OperationalIntelligencePanels data={panelData} loading={loading} />
        </div>
      </div>

      <div className="border-t border-[var(--color-border-subtle)] lg:hidden">
        <div className="grid max-h-[40vh] grid-cols-1 gap-0 sm:grid-cols-2">
          <LiveOperationalStream events={events} loading={loading} />
          <OperationalIntelligencePanels data={panelData} loading={loading} />
        </div>
      </div>
    </div>
  );
}
