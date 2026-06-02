import type { DeliveryMode } from "@memory-middleware/shared-types";

export interface DeliveryModeProfile {
  includeSummaries: boolean;
  headingLevel: 1 | 2 | 3;
  useDomainLabels: boolean;
  compactBullets: boolean;
  maxBulletsPerSection: number | null;
  dedupeLines: boolean;
}

const MODE_PROFILES: Record<DeliveryMode, DeliveryModeProfile> = {
  concise: {
    includeSummaries: false,
    headingLevel: 2,
    useDomainLabels: false,
    compactBullets: true,
    maxBulletsPerSection: 8,
    dedupeLines: true,
  },
  balanced: {
    includeSummaries: false,
    headingLevel: 2,
    useDomainLabels: false,
    compactBullets: false,
    maxBulletsPerSection: null,
    dedupeLines: true,
  },
  detailed: {
    includeSummaries: true,
    headingLevel: 1,
    useDomainLabels: false,
    compactBullets: false,
    maxBulletsPerSection: null,
    dedupeLines: false,
  },
  operational: {
    includeSummaries: true,
    headingLevel: 2,
    useDomainLabels: true,
    compactBullets: false,
    maxBulletsPerSection: null,
    dedupeLines: true,
  },
};

export function getDeliveryModeProfile(mode: DeliveryMode): DeliveryModeProfile {
  return MODE_PROFILES[mode];
}
