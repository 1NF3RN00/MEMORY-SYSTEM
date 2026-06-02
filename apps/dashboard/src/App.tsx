import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout.js";
import { ContextDeliveryPage } from "./pages/ContextDeliveryPage.js";
import { CompressionTracesPage } from "./pages/CompressionTracesPage.js";
import { HistorianPage } from "./pages/HistorianPage.js";
import { HomePage } from "./pages/HomePage.js";
import { IngestPage } from "./pages/IngestPage.js";
import { IngestionTracesPage } from "./pages/IngestionTracesPage.js";
import { MemoryExplorerPage } from "./pages/MemoryExplorerPage.js";
import { ObservabilityPage } from "./pages/ObservabilityPage.js";
import { PlanningPage } from "./pages/PlanningPage.js";
import { RetrievalDiagnosticsPage } from "./pages/RetrievalDiagnosticsPage.js";
import { RetrievalTracesPage } from "./pages/RetrievalTracesPage.js";
import { RelationshipMapPage } from "./pages/RelationshipMapPage.js";
import { HowItWorksPage } from "./pages/HowItWorksPage.js";

export function App() {
  const location = useLocation();
  const showMetrics =
    !location.pathname.startsWith("/relationship-map") &&
    !location.pathname.startsWith("/how-it-works");

  return (
    <Layout showMetrics={showMetrics}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/ingest" element={<IngestPage />} />
        <Route path="/ingestion" element={<IngestionTracesPage />} />
        <Route path="/ingestion/:traceId" element={<IngestionTracesPage />} />
        <Route path="/memory/:id" element={<MemoryExplorerPage />} />
        <Route path="/memory" element={<MemoryExplorerPage />} />
        <Route path="/relationship-map" element={<RelationshipMapPage />} />
        <Route path="/observability" element={<ObservabilityPage />} />
        <Route path="/retrieval-diagnostics" element={<RetrievalDiagnosticsPage />} />
        <Route path="/retrieval-diagnostics/:traceId" element={<RetrievalDiagnosticsPage />} />
        <Route path="/retrieval-traces" element={<RetrievalTracesPage />} />
        <Route path="/retrieval-traces/:traceId" element={<RetrievalTracesPage />} />
        <Route path="/planning" element={<PlanningPage />} />
        <Route path="/planning/:planId" element={<PlanningPage />} />
        <Route path="/compression-traces" element={<CompressionTracesPage />} />
        <Route path="/compression-traces/:traceId" element={<CompressionTracesPage />} />
        <Route path="/context-delivery" element={<ContextDeliveryPage />} />
        <Route path="/context-delivery/:deliveryId" element={<ContextDeliveryPage />} />
        <Route path="/historian" element={<HistorianPage />} />
        <Route path="/historian/:traceId" element={<HistorianPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
