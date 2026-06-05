import type {
  CollectInput,
  CollectResult,
  ObservationProvider,
} from "@memory-middleware/shared-types";
import { listProviders } from "@memory-middleware/observation-registry";
import { crawlSite } from "../crawl-site.js";
import { runPageSpeed } from "../pagespeed-client.js";
import { normalizeWebsiteObservations } from "../normalize/website.js";

const PROVIDER_KEY = "website";

export interface WebsiteProviderConfig {
  pagespeedApiKey?: string;
  fetchFn?: typeof fetch;
  maxPages?: number;
}

export function createWebsiteProvider(config: WebsiteProviderConfig = {}): ObservationProvider {
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

      const fetchFn = config.fetchFn ?? fetch;
      const crawl = await crawlSite(
        url,
        config.maxPages !== undefined ? { fetchFn, maxPages: config.maxPages } : { fetchFn },
      );

      let accessibilityScore: number | undefined;
      if (config.pagespeedApiKey) {
        const mobileRun = await runPageSpeed(url, "mobile", config.pagespeedApiKey, fetchFn);
        if (mobileRun.accessibilityScore !== null) {
          accessibilityScore = mobileRun.accessibilityScore;
        }
      }

      const observations = normalizeWebsiteObservations(crawl, input, accessibilityScore);

      return {
        providerKey: PROVIDER_KEY,
        observations,
        rawItemCount: crawl.pages.length,
        collectedAt: crawl.collectedAt,
      };
    },
  };
}
