import { normalizeObservationFromRegistry } from "@memory-middleware/observation-registry";
import type { CollectInput, Observation, ObservationValue } from "@memory-middleware/shared-types";

export interface ObservationDraft {
  category: string;
  metric: string;
  value: ObservationValue;
  sourceLabel?: string;
  competitorId?: string;
  platform?: string;
}

export function buildProviderObservations(
  input: CollectInput,
  providerKey: string,
  source: string,
  drafts: ObservationDraft[],
  collectedAt: string,
): Observation[] {
  return drafts.map((draft) =>
    normalizeObservationFromRegistry(
      {
        workspaceId: input.workspaceId,
        metric: draft.metric,
        value: draft.value,
        source,
        timestamp: collectedAt,
        metadata: {
          provider: providerKey,
          category: draft.category,
          metric: draft.metric,
          collectedAt,
          ...(draft.sourceLabel ? { sourceLabel: draft.sourceLabel } : {}),
          ...(input.businessId ? { businessId: input.businessId } : {}),
          ...(draft.competitorId ?? input.competitorId
            ? { competitorId: draft.competitorId ?? input.competitorId }
            : {}),
          ...(draft.platform ? { platform: draft.platform } : {}),
        },
      },
      providerKey,
      {
        categoryKey: draft.category,
        metricKey: draft.metric,
        defaultWorkspaceId: input.workspaceId,
        defaultSource: source,
      },
    ),
  );
}
