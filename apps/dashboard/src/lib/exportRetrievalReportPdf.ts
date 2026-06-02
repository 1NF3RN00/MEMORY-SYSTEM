import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface RetrievalReportPdfMetrics {
  retrievalPrecision: number;
  retrievalBreadth: number;
  semanticCohesion: number;
  contextualDensity: number;
  rankingStability: number;
  relationshipUsefulness: number;
  chunkQuality: number;
  tokenEfficiency: number;
  compressionIntegrity: number;
  renderingQuality: number;
}

export interface RetrievalReportPdfProblem {
  stage: string;
  severity: string;
  issue: string;
  recommendation: string;
}

export interface RetrievalReportPdfStage {
  stage: string;
  latencyMs: number;
  status: string;
  score: number;
  summary: string;
}

export interface RetrievalReportPdfInput {
  report: {
    reportId: string;
    retrievalTraceId: string;
    query: string;
    metrics: RetrievalReportPdfMetrics;
    detectedProblems: RetrievalReportPdfProblem[];
    generatedAt: string;
  };
  traceAnalysis?: {
    stages: RetrievalReportPdfStage[];
    queryDiagnostics: { issues: string[]; keywordCount?: number; decompositionQuality?: number };
    retrievalDiagnostics: { issues: string[]; includedCount?: number; rejectedBelowThreshold?: number };
    rankingDiagnostics: { issues: string[] };
    chunkDiagnostics: { issues: string[] };
    relationshipDiagnostics: { issues: string[]; augmentationApplied?: boolean; neighborCount?: number };
    compressionDiagnostics: { issues: string[]; fidelityPreservation?: number; tokenSavings?: number };
    renderingDiagnostics: { issues: string[] };
  };
  signalQuality?: {
    contextualDensity: number;
    semanticCohesion: number;
    relationshipUsefulness: number;
    tokenEfficiency: number;
    signalToNoiseRatio: number;
  };
  workspaceId?: string;
}

const METRIC_ROWS: Array<{ key: keyof RetrievalReportPdfMetrics; label: string; description: string }> = [
  {
    key: "retrievalPrecision",
    label: "Retrieval Precision",
    description: "Semantic alignment between the query and included retrieved chunks.",
  },
  {
    key: "retrievalBreadth",
    label: "Retrieval Breadth",
    description: "Coverage of relevant contextual memories relative to candidates considered.",
  },
  {
    key: "semanticCohesion",
    label: "Semantic Cohesion",
    description: "How semantically aligned retrieved chunks are with each other.",
  },
  {
    key: "contextualDensity",
    label: "Contextual Density",
    description: "Signal-to-noise ratio — ranking signal mass relative to token cost.",
  },
  {
    key: "rankingStability",
    label: "Ranking Stability",
    description: "Consistency of rank ordering; sensitive weighting lowers stability.",
  },
  {
    key: "relationshipUsefulness",
    label: "Relationship Usefulness",
    description: "Whether relationship augmentation improved ranked results.",
  },
  {
    key: "chunkQuality",
    label: "Chunk Quality",
    description: "Effectiveness of chunk segmentation under token budget and deduplication.",
  },
  {
    key: "tokenEfficiency",
    label: "Token Efficiency",
    description: "Contextual value delivered per token in the assembled package.",
  },
  {
    key: "compressionIntegrity",
    label: "Compression Integrity",
    description: "Whether compression preserved retrieval fidelity.",
  },
  {
    key: "renderingQuality",
    label: "Rendering Quality",
    description: "Whether context delivery rendering improved inference clarity.",
  },
];

const PIPELINE_NARRATIVE: Array<{ stage: string; title: string; description: string }> = [
  {
    stage: "query",
    title: "1. Query",
    description:
      "The operational query enters the middleware as the retrieval intent. This ULID trace anchors all downstream stages, replay snapshots, and calibration benchmarks.",
  },
  {
    stage: "preprocessing",
    title: "2. Preprocessing",
    description:
      "Query normalization tokenizes and cleans input, producing keywords and a normalized form used for vector search and metadata matching.",
  },
  {
    stage: "decomposition",
    title: "3. Decomposition",
    description:
      "Operational concepts, entities, and domains are extracted to structure retrieval planning and expansion hints.",
  },
  {
    stage: "metadata_expansion",
    title: "4. Metadata Expansion",
    description:
      "Tags, relationships, and operational domains expand the retrieval surface without overriding semantic precision.",
  },
  {
    stage: "retrieval",
    title: "5. Vector Retrieval",
    description:
      "Embedding similarity search retrieves candidate chunks. Similarity thresholds and top-K control precision vs breadth.",
  },
  {
    stage: "ranking",
    title: "6. Ranking",
    description:
      "Semantic similarity is combined with recency, importance, reinforcement, and semantic density boosts to produce final scores.",
  },
  {
    stage: "relationships",
    title: "7. Relationship Augmentation",
    description:
      "Memory relationships may nudge ranking for co-occurring or structurally adjacent neighbors — subordinate to semantic similarity.",
  },
  {
    stage: "compression",
    title: "8. Compression",
    description:
      "Optional semantic merge and trimming reduce token cost while fidelity validation preserves retrieval quality.",
  },
  {
    stage: "rendering",
    title: "9. Rendering",
    description:
      "Operational middleware traces are stripped; context is grouped, hierarchically formatted, and optimized for downstream LLM inference.",
  },
  {
    stage: "delivery",
    title: "10. Delivery",
    description:
      "The rendered context package is delivered with observability metadata removed — the final inference-ready output.",
  },
];

const PAGE_MARGIN = 14;
const LINE_HEIGHT = 5;
const FOOTER_Y = 287;

function scoreLabel(value: number): string {
  if (value >= 0.75) return "Strong";
  if (value >= 0.55) return "Acceptable";
  if (value >= 0.4) return "Weak";
  return "Critical";
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > FOOTER_Y - 10) {
    doc.addPage();
    return PAGE_MARGIN + 8;
  }
  return y;
}

function addFooter(doc: jsPDF, traceId: string, pageNum: number, totalPages: number) {
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(`Retrieval trace: ${traceId}`, PAGE_MARGIN, 290);
  doc.text(`Page ${pageNum} of ${totalPages}`, 210 - PAGE_MARGIN, 290, { align: "right" });
  doc.setTextColor(0, 0, 0);
}

function wrapText(doc: jsPDF, text: string, x: number, y: number, maxWidth: number, lineHeight = LINE_HEIGHT): number {
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

export function buildRetrievalReportPdfFilename(traceId: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `retrieval-quality-report-${traceId.slice(0, 10)}-${stamp}.pdf`;
}

export function exportRetrievalReportPdf(input: RetrievalReportPdfInput): void {
  const { report, traceAnalysis, signalQuality, workspaceId } = input;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = PAGE_MARGIN;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Retrieval Quality System Report", PAGE_MARGIN, y);
  y += 10;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(80, 80, 80);
  y = wrapText(
    doc,
    "Deterministic diagnostics export for a single retrieval trace. This document explains the full contextual middleware pipeline, quality metrics, stage inspection, and calibration recommendations associated with the trace ULID below.",
    PAGE_MARGIN,
    y,
    182,
  );
  y += 4;
  doc.setTextColor(0, 0, 0);

  autoTable(doc, {
    startY: y,
    head: [["Field", "Value"]],
    body: [
      ["Retrieval trace ULID", report.retrievalTraceId],
      ["Report ID", report.reportId],
      ...(workspaceId ? [["Workspace ID", workspaceId]] : []),
      ["Original query", report.query],
      ["Report generated", new Date(report.generatedAt).toLocaleString()],
      ["Export generated", new Date().toLocaleString()],
    ],
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [30, 30, 30] },
    columnStyles: { 0: { cellWidth: 45, fontStyle: "bold" } },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Pipeline Process Overview", PAGE_MARGIN, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const step of PIPELINE_NARRATIVE) {
    y = ensureSpace(doc, y, 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    y = wrapText(doc, step.title, PAGE_MARGIN, y, 182, 4.5);
    doc.setFont("helvetica", "normal");
    y = wrapText(doc, step.description, PAGE_MARGIN, y + 1, 182);
    y += 3;

    const stageTrace = traceAnalysis?.stages.find((s) => s.stage === step.stage);
    if (stageTrace) {
      doc.setFontSize(9);
      doc.setTextColor(60, 60, 60);
      y = wrapText(
        doc,
        `Observed: ${stageTrace.status} · score ${stageTrace.score.toFixed(2)} · ${stageTrace.latencyMs}ms — ${stageTrace.summary}`,
        PAGE_MARGIN + 2,
        y,
        178,
        4,
      );
      doc.setTextColor(0, 0, 0);
      y += 2;
    }
  }

  y = ensureSpace(doc, y, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Retrieval Quality Metrics", PAGE_MARGIN, y);
  y += 7;

  autoTable(doc, {
    startY: y,
    head: [["Metric", "Score", "Rating", "Description"]],
    body: METRIC_ROWS.map((row) => [
      row.label,
      report.metrics[row.key].toFixed(3),
      scoreLabel(report.metrics[row.key]),
      row.description,
    ]),
    styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 38 },
      1: { cellWidth: 16, halign: "right" },
      2: { cellWidth: 22 },
      3: { cellWidth: 80 },
    },
  });

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  if (signalQuality) {
    y = ensureSpace(doc, y, 35);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Signal Quality Summary", PAGE_MARGIN, y);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [["Signal", "Value"]],
      body: [
        ["Contextual density", signalQuality.contextualDensity.toFixed(3)],
        ["Semantic cohesion", signalQuality.semanticCohesion.toFixed(3)],
        ["Relationship usefulness", signalQuality.relationshipUsefulness.toFixed(3)],
        ["Token efficiency", signalQuality.tokenEfficiency.toFixed(4)],
        ["Signal-to-noise ratio", signalQuality.signalToNoiseRatio.toFixed(3)],
      ],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 30, 30] },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  if (traceAnalysis && traceAnalysis.stages.length > 0) {
    y = ensureSpace(doc, y, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text("Stage-by-Stage Trace Inspection", PAGE_MARGIN, y);
    y += 7;

    autoTable(doc, {
      startY: y,
      head: [["Stage", "Status", "Score", "Latency", "Summary"]],
      body: traceAnalysis.stages.map((s) => [
        s.stage.replace(/_/g, " "),
        s.status,
        s.score.toFixed(2),
        `${s.latencyMs}ms`,
        s.summary,
      ]),
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 22 },
        2: { cellWidth: 14, halign: "right" },
        3: { cellWidth: 18 },
        4: { cellWidth: 72 },
      },
    });

    y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

    const diagnosticBlocks = [
      { label: "Query diagnostics", issues: traceAnalysis.queryDiagnostics.issues },
      { label: "Retrieval diagnostics", issues: traceAnalysis.retrievalDiagnostics.issues },
      { label: "Ranking diagnostics", issues: traceAnalysis.rankingDiagnostics.issues },
      { label: "Chunk diagnostics", issues: traceAnalysis.chunkDiagnostics.issues },
      { label: "Relationship diagnostics", issues: traceAnalysis.relationshipDiagnostics.issues },
      { label: "Compression diagnostics", issues: traceAnalysis.compressionDiagnostics.issues },
      { label: "Rendering diagnostics", issues: traceAnalysis.renderingDiagnostics.issues },
    ];

    y = ensureSpace(doc, y, 20);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Stage Diagnostic Notes", PAGE_MARGIN, y);
    y += 6;

    for (const block of diagnosticBlocks) {
      y = ensureSpace(doc, y, 12);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(block.label, PAGE_MARGIN, y);
      y += 5;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      if (block.issues.length === 0) {
        y = wrapText(doc, "No issues detected.", PAGE_MARGIN + 2, y, 178, 4);
      } else {
        for (const issue of block.issues) {
          y = ensureSpace(doc, y, 8);
          y = wrapText(doc, `• ${issue}`, PAGE_MARGIN + 2, y, 178, 4);
        }
      }
      y += 2;
    }
  }

  y = ensureSpace(doc, y, 25);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Detected Problems (${report.detectedProblems.length})`, PAGE_MARGIN, y);
  y += 7;

  if (report.detectedProblems.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    wrapText(doc, "No operational problems were detected for this trace.", PAGE_MARGIN, y, 182);
  } else {
    autoTable(doc, {
      startY: y,
      head: [["Severity", "Stage", "Issue", "Recommendation"]],
      body: report.detectedProblems.map((p) => [
        p.severity.toUpperCase(),
        p.stage.replace(/_/g, " "),
        p.issue,
        p.recommendation,
      ]),
      styles: { fontSize: 8, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 24 },
        2: { cellWidth: 58 },
        3: { cellWidth: 58 },
      },
    });
  }

  y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  y = ensureSpace(doc, y, 20);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  doc.setTextColor(90, 90, 90);
  wrapText(
    doc,
    "This report is deterministic and replayable. Use the retrieval trace ULID in the Historian & Replay system to benchmark calibration changes. No autonomous optimization was applied — all recommendations require explicit operational tuning.",
    PAGE_MARGIN,
    y,
    182,
    4,
  );

  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    addFooter(doc, report.retrievalTraceId, page, totalPages);
  }

  doc.save(buildRetrievalReportPdfFilename(report.retrievalTraceId));
}
