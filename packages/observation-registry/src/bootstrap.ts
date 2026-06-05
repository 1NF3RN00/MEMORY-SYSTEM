import { METRIC_CATALOG, PROVIDER_CATALOG } from "./metric-catalog.js";
import { ObservationRegistry, defaultRegistry } from "./registry.js";

export function bootstrapDefaultRegistry(registry: ObservationRegistry = defaultRegistry): void {
  for (const provider of PROVIDER_CATALOG) {
    if (!registry.getProvider(provider.providerKey)) {
      registry.registerProvider(provider);
    }
  }
  for (const metric of METRIC_CATALOG) {
    if (
      !registry.getMetric(metric.providerKey, metric.categoryKey, metric.metricKey)
    ) {
      registry.registerMetric(metric);
    }
  }
}
