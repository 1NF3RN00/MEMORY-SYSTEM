import type { ObservationProvider } from "@memory-middleware/shared-types";
import { createApifyClient } from "./apify/client.js";
import { createApifyProviders } from "./providers/apify-providers.js";
import { createPageSpeedProvider } from "./providers/pagespeed.js";
import { createWebsiteProvider } from "./providers/website.js";

export interface ProviderRuntimeConfig {
  pagespeedApiKey?: string;
  apifyApiToken?: string;
  fetchFn?: typeof fetch;
  maxCrawlPages?: number;
}

const runtimeProviders = new Map<string, ObservationProvider>();

export function registerRuntimeProvider(provider: ObservationProvider): void {
  runtimeProviders.set(provider.definition.providerKey, provider);
}

export function getRuntimeProvider(providerKey: string): ObservationProvider | undefined {
  return runtimeProviders.get(providerKey);
}

export function listRuntimeProviders(): ObservationProvider[] {
  return [...runtimeProviders.values()].sort((a, b) =>
    a.definition.providerKey.localeCompare(b.definition.providerKey),
  );
}

export function getApifyClientFromConfig(config: ProviderRuntimeConfig) {
  if (!config.apifyApiToken) return null;
  return createApifyClient(config.apifyApiToken);
}

export function bootstrapBuiltInProviders(config: ProviderRuntimeConfig = {}): void {
  runtimeProviders.clear();

  const websiteConfig: Parameters<typeof createWebsiteProvider>[0] = {};
  if (config.pagespeedApiKey) websiteConfig.pagespeedApiKey = config.pagespeedApiKey;
  if (config.fetchFn) websiteConfig.fetchFn = config.fetchFn;
  if (config.maxCrawlPages !== undefined) websiteConfig.maxPages = config.maxCrawlPages;

  registerRuntimeProvider(createWebsiteProvider(websiteConfig));

  if (config.pagespeedApiKey) {
    const pagespeedConfig: Parameters<typeof createPageSpeedProvider>[0] = {
      apiKey: config.pagespeedApiKey,
    };
    if (config.fetchFn) pagespeedConfig.fetchFn = config.fetchFn;
    registerRuntimeProvider(createPageSpeedProvider(pagespeedConfig));
  }

  if (config.apifyApiToken) {
    const apifyClient = createApifyClient(config.apifyApiToken);
    for (const provider of createApifyProviders(apifyClient)) {
      registerRuntimeProvider(provider);
    }
  }
}
