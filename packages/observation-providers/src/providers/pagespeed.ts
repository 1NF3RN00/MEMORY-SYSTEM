import type {
  CollectInput,
  CollectResult,
  ObservationProvider,
} from "@memory-middleware/shared-types";
import { listProviders } from "@memory-middleware/observation-registry";
import { runPageSpeed } from "../pagespeed-client.js";
import { normalizePageSpeedObservations } from "../normalize/pagespeed.js";

const PROVIDER_KEY = "pagespeed";

export interface PageSpeedProviderConfig {
  apiKey: string;
  fetchFn?: typeof fetch;
}

export function createPageSpeedProvider(config: PageSpeedProviderConfig): ObservationProvider {
  const definition = listProviders().find((provider) => provider.providerKey === PROVIDER_KEY);
  if (!definition) {
    throw new Error(`Provider definition missing: ${PROVIDER_KEY}`);
  }

  return {
    definition,
    async collect(input: CollectInput): Promise<CollectResult> {
      const url = input.params.url;
      if (typeof url !== "string" || !url.trim()) {
        throw new Error("params.url is required");
      }

      const strategy = input.params.strategy;
      const fetchFn = config.fetchFn ?? fetch;
      const collectedAt = new Date().toISOString();

      const runMobile = strategy !== "desktop";
      const runDesktop = strategy !== "mobile";

      const mobile = runMobile
        ? await runPageSpeed(url, "mobile", config.apiKey, fetchFn)
        : {
            strategy: "mobile" as const,
            performanceScore: null,
            accessibilityScore: null,
            speedIndex: null,
            largestContentfulPaint: null,
            cumulativeLayoutShift: null,
            totalBlockingTime: null,
            firstContentfulPaint: null,
          };

      const desktop = runDesktop
        ? await runPageSpeed(url, "desktop", config.apiKey, fetchFn)
        : {
            strategy: "desktop" as const,
            performanceScore: null,
            accessibilityScore: null,
            speedIndex: null,
            largestContentfulPaint: null,
            cumulativeLayoutShift: null,
            totalBlockingTime: null,
            firstContentfulPaint: null,
          };

      const observations = normalizePageSpeedObservations(
        mobile,
        desktop,
        input,
        url,
        collectedAt,
      );

      if (observations.length === 0) {
        throw new Error("PageSpeed returned no usable metrics");
      }

      return {
        providerKey: PROVIDER_KEY,
        observations,
        rawItemCount: (runMobile ? 1 : 0) + (runDesktop ? 1 : 0),
        collectedAt,
      };
    },
  };
}
