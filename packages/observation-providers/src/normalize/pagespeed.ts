import type { CollectInput, Observation } from "@memory-middleware/shared-types";
import { normalizeObservationFromRegistry } from "@memory-middleware/observation-registry";
import type { PageSpeedRunResult } from "../pagespeed-client.js";

const PROVIDER_KEY = "pagespeed";
const SOURCE = "pagespeed_insights";

interface MetricDraft {
  category: string;
  metric: string;
  value: number;
}

function draftsFromRuns(mobile: PageSpeedRunResult, desktop: PageSpeedRunResult): MetricDraft[] {
  const drafts: MetricDraft[] = [];

  if (mobile.performanceScore !== null) {
    drafts.push({
      category: "performance",
      metric: "mobile_score",
      value: mobile.performanceScore,
    });
  }
  if (desktop.performanceScore !== null) {
    drafts.push({
      category: "performance",
      metric: "desktop_score",
      value: desktop.performanceScore,
    });
  }

  const vitalsSource = mobile.performanceScore !== null ? mobile : desktop;
  if (vitalsSource.speedIndex !== null) {
    drafts.push({ category: "performance", metric: "speed_index", value: vitalsSource.speedIndex });
  }
  if (vitalsSource.largestContentfulPaint !== null) {
    drafts.push({
      category: "core_web_vitals",
      metric: "largest_contentful_paint",
      value: vitalsSource.largestContentfulPaint,
    });
  }
  if (vitalsSource.cumulativeLayoutShift !== null) {
    drafts.push({
      category: "core_web_vitals",
      metric: "cumulative_layout_shift",
      value: vitalsSource.cumulativeLayoutShift,
    });
  }
  if (vitalsSource.totalBlockingTime !== null) {
    drafts.push({
      category: "core_web_vitals",
      metric: "total_blocking_time",
      value: vitalsSource.totalBlockingTime,
    });
  }
  if (vitalsSource.firstContentfulPaint !== null) {
    drafts.push({
      category: "core_web_vitals",
      metric: "first_contentful_paint",
      value: vitalsSource.firstContentfulPaint,
    });
  }

  return drafts;
}

export function normalizePageSpeedObservations(
  mobile: PageSpeedRunResult,
  desktop: PageSpeedRunResult,
  input: CollectInput,
  url: string,
  collectedAt: string,
): Observation[] {
  const drafts = draftsFromRuns(mobile, desktop);

  return drafts.map((draft) =>
    normalizeObservationFromRegistry(
      {
        workspaceId: input.workspaceId,
        metric: draft.metric,
        value: draft.value,
        source: SOURCE,
        timestamp: collectedAt,
        metadata: {
          provider: PROVIDER_KEY,
          category: draft.category,
          metric: draft.metric,
          collectedAt,
          sourceLabel: url,
          ...(input.businessId ? { businessId: input.businessId } : {}),
          ...(input.competitorId ? { competitorId: input.competitorId } : {}),
        },
      },
      PROVIDER_KEY,
      {
        categoryKey: draft.category,
        metricKey: draft.metric,
        defaultWorkspaceId: input.workspaceId,
        defaultSource: SOURCE,
      },
    ),
  );
}
