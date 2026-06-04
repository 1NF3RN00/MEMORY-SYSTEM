import type { PackageManifestDiff } from "@memory-middleware/shared-types";
import { Badge } from "../ui/Badge.js";
import { Panel } from "../ui/Panel.js";

interface PackageDiffViewProps {
  diff: PackageManifestDiff;
}

function EntityDiff({ label, added, removed, changed }: { label: string; added: string[]; removed: string[]; changed: string[] }) {
  const hasChanges = added.length > 0 || removed.length > 0 || changed.length > 0;
  if (!hasChanges) return null;
  return (
    <div className="rounded-md border border-[var(--color-border-subtle)] p-3">
      <p className="mb-2 font-metric text-[0.625rem] uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        {added.map((item) => (
          <Badge key={`add-${item}`} variant="success">
            + {item}
          </Badge>
        ))}
        {changed.map((item) => (
          <Badge key={`chg-${item}`} variant="warning">
            ~ {item}
          </Badge>
        ))}
        {removed.map((item) => (
          <Badge key={`rm-${item}`} variant="danger">
            − {item}
          </Badge>
        ))}
      </div>
    </div>
  );
}

export function PackageDiffView({ diff }: PackageDiffViewProps) {
  return (
    <Panel title="Manifest comparison" code="DIFF">
      {diff.versionChanged && (
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          Version: {diff.versionChanged.from} → {diff.versionChanged.to}
        </p>
      )}

      <EntityDiff
        label="Global facts"
        added={diff.globalFacts.added}
        removed={diff.globalFacts.removed}
        changed={diff.globalFacts.changed}
      />

      {(diff.domains.added.length > 0 || diff.domains.removed.length > 0) && (
        <div className="mt-4 space-y-2">
          <p className="font-metric text-[0.625rem] uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Domains
          </p>
          <div className="flex flex-wrap gap-2">
            {diff.domains.added.map((key) => (
              <Badge key={`d-add-${key}`} variant="success">
                + {key}
              </Badge>
            ))}
            {diff.domains.removed.map((key) => (
              <Badge key={`d-rm-${key}`} variant="danger">
                − {key}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {diff.domains.changed.length > 0 && (
        <div className="mt-4 space-y-3">
          {diff.domains.changed.map((domainDiff) => (
            <div
              key={domainDiff.domainKey}
              className="rounded-md border border-[var(--color-border-subtle)] p-3"
            >
              <p className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
                {domainDiff.domainKey}
              </p>
              <div className="space-y-2">
                <EntityDiff
                  label="Facts"
                  added={domainDiff.facts.added}
                  removed={domainDiff.facts.removed}
                  changed={domainDiff.facts.changed}
                />
                <EntityDiff
                  label="Instructions"
                  added={domainDiff.instructions.added}
                  removed={domainDiff.instructions.removed}
                  changed={domainDiff.instructions.changed}
                />
                {(domainDiff.metadataFiltersChanged ||
                  domainDiff.retrievalRulesChanged ||
                  domainDiff.relationshipConstraintsChanged) && (
                  <div className="flex flex-wrap gap-2">
                    {domainDiff.metadataFiltersChanged && (
                      <Badge variant="warning">metadata filters</Badge>
                    )}
                    {domainDiff.retrievalRulesChanged && (
                      <Badge variant="warning">retrieval rules</Badge>
                    )}
                    {domainDiff.relationshipConstraintsChanged && (
                      <Badge variant="warning">relationship constraints</Badge>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
