import type {
  PackageManifest,
  PackageManifestDiff,
  PackageManifestDomain,
  PackageManifestEntityDiff,
} from "@memory-middleware/shared-types";

function stableJson(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function entityDiff(
  currentKeys: string[],
  candidateKeys: string[],
  isChanged: (key: string) => boolean,
): PackageManifestEntityDiff {
  const current = new Set(currentKeys);
  const candidate = new Set(candidateKeys);
  const added = candidateKeys.filter((k) => !current.has(k));
  const removed = currentKeys.filter((k) => !candidate.has(k));
  const changed = candidateKeys.filter((k) => current.has(k) && isChanged(k));
  return { added, removed, changed };
}

function globalFactKeys(manifest: PackageManifest): string[] {
  return (manifest.globalFacts ?? []).map((f) => f.key);
}

function domainByKey(manifest: PackageManifest): Map<string, PackageManifestDomain> {
  return new Map(manifest.domains.map((d) => [d.domainKey, d]));
}

function factKeys(domain: PackageManifestDomain): string[] {
  return (domain.facts ?? []).map((f) => f.key);
}

function instructionKeys(domain: PackageManifestDomain): string[] {
  return (domain.instructions ?? []).map((i) => i.actionKey);
}

export function comparePackageManifests(
  current: PackageManifest,
  candidate: PackageManifest,
): PackageManifestDiff {
  const currentDomains = domainByKey(current);
  const candidateDomains = domainByKey(candidate);

  const domainKeysCurrent = [...currentDomains.keys()];
  const domainKeysCandidate = [...candidateDomains.keys()];

  const domainAdded = domainKeysCandidate.filter((k) => !currentDomains.has(k));
  const domainRemoved = domainKeysCurrent.filter((k) => !candidateDomains.has(k));
  const domainChangedKeys = domainKeysCandidate.filter((k) => currentDomains.has(k));

  const changedDomains = domainChangedKeys.map((domainKey) => {
    const cur = currentDomains.get(domainKey)!;
    const cand = candidateDomains.get(domainKey)!;

    const curFacts = new Map((cur.facts ?? []).map((f) => [f.key, f]));
    const candFacts = new Map((cand.facts ?? []).map((f) => [f.key, f]));

    const curInstructions = new Map((cur.instructions ?? []).map((i) => [i.actionKey, i]));
    const candInstructions = new Map((cand.instructions ?? []).map((i) => [i.actionKey, i]));

    return {
      domainKey,
      facts: entityDiff(factKeys(cur), factKeys(cand), (key) => {
        const a = curFacts.get(key);
        const b = candFacts.get(key);
        return stableJson(a) !== stableJson(b);
      }),
      instructions: entityDiff(instructionKeys(cur), instructionKeys(cand), (key) => {
        const a = curInstructions.get(key);
        const b = candInstructions.get(key);
        return stableJson(a) !== stableJson(b);
      }),
      metadataFiltersChanged:
        stableJson(cur.metadataFilters) !== stableJson(cand.metadataFilters),
      relationshipConstraintsChanged:
        stableJson(cur.relationshipConstraints) !== stableJson(cand.relationshipConstraints),
      retrievalRulesChanged:
        stableJson(cur.retrievalRules) !== stableJson(cand.retrievalRules),
    };
  }).filter(
    (d) =>
      d.facts.added.length > 0 ||
      d.facts.removed.length > 0 ||
      d.facts.changed.length > 0 ||
      d.instructions.added.length > 0 ||
      d.instructions.removed.length > 0 ||
      d.instructions.changed.length > 0 ||
      d.metadataFiltersChanged ||
      d.relationshipConstraintsChanged ||
      d.retrievalRulesChanged,
  );

  const curGlobal = new Map((current.globalFacts ?? []).map((f) => [f.key, f]));
  const candGlobal = new Map((candidate.globalFacts ?? []).map((f) => [f.key, f]));

  return {
    packageKey: current.packageKey,
    versionChanged:
      current.version !== candidate.version
        ? { from: current.version, to: candidate.version }
        : null,
    globalFacts: entityDiff(globalFactKeys(current), globalFactKeys(candidate), (key) => {
      const a = curGlobal.get(key);
      const b = candGlobal.get(key);
      return stableJson(a) !== stableJson(b);
    }),
    domains: {
      added: domainAdded,
      removed: domainRemoved,
      changed: changedDomains,
    },
  };
}
