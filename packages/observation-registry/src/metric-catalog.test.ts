import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bootstrapDefaultRegistry } from "./bootstrap.js";
import { METRIC_CATALOG, PROVIDER_CATALOG } from "./metric-catalog.js";
import { ObservationRegistry, defaultRegistry } from "./registry.js";

describe("metric catalog", () => {
  it("seeds all providers from METRIC_CATALOG", () => {
    const registry = new ObservationRegistry();
    bootstrapDefaultRegistry(registry);

    assert.equal(PROVIDER_CATALOG.length, 10);
    assert.equal(registry.listProviders().length, 10);

    for (const provider of PROVIDER_CATALOG) {
      const registered = registry.getProvider(provider.providerKey);
      assert.ok(registered, `missing provider ${provider.providerKey}`);
      assert.deepEqual(
        [...registered.categories].sort(),
        [...provider.categories].sort(),
      );
      assert.deepEqual([...registered.metrics].sort(), [...provider.metrics].sort());
    }
  });

  it("registers every METRIC_CATALOG row", () => {
    const registry = new ObservationRegistry();
    bootstrapDefaultRegistry(registry);

    assert.equal(METRIC_CATALOG.length, 53);
    assert.equal(registry.listMetrics().length, 53);

    for (const row of METRIC_CATALOG) {
      const metric = registry.getMetric(row.providerKey, row.categoryKey, row.metricKey);
      assert.ok(metric, `missing metric ${row.providerKey}:${row.categoryKey}:${row.metricKey}`);
      assert.equal(metric.valueType, row.valueType);
      assert.equal(metric.description, row.description);
    }
  });

  it("bootstrapDefaultRegistry is idempotent on defaultRegistry", () => {
    bootstrapDefaultRegistry();
    bootstrapDefaultRegistry();
    assert.equal(defaultRegistry.listMetrics().length, 53);
  });
});
