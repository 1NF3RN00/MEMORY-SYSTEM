# Installable Package Manifests

Per [../DOMAINS_PACKAGES_WORKFLOWS.md](../DOMAINS_PACKAGES_WORKFLOWS.md): **do not hardcode** these domains or workflows in middleware. Ship as JSON manifests installable via `POST /packages/install`.

Location: `packages/package-manifests/` (new directory, not imported by runtime — loaded as files or published to `PackageDefinition` catalog).

---

## Manifest format

```json
{
  "packageKey": "marketing-intelligence",
  "name": "Marketing Intelligence",
  "version": "1.0.0",
  "description": "SEO, social, reputation, and competitor observation domains with audit workflows",
  "domains": [ ],
  "globalFacts": [ ],
  "domainFacts": [ ],
  "instructions": [ ],
  "workflows": [ ]
}
```

---

## Package: `marketing-intelligence`

File: `packages/package-manifests/marketing-intelligence/manifest.json`

### Domains

| domainKey | observationFilters |
|-----------|-------------------|
| `website` | providers: `[website, pagespeed]`, categories: `[site_structure, metadata, technical_seo, performance, core_web_vitals]` |
| `competitor` | categories: `[website, reputation, visibility, social]`, metrics: `[competitor_*]` pattern via metadata match |
| `reputation` | providers: `[google_business]`, categories: `[profile_quality, reputation, engagement]` |
| `social` | providers: `[facebook, instagram, tiktok]`, categories: `[presence, activity, engagement, growth]` |
| `strategy` | `[]` — facts/instructions only |
| `brand` | `[]` — facts/instructions only |

### Workflows

| workflowKey | domains | analysisSpecKey | outputTypes |
|-------------|---------|-----------------|-------------|
| `seo-audit` | website, competitor, strategy | `seo_audit_v1` | report |
| `competitive-gap-analysis` | competitor, website, reputation, social | `competitive_gap_v1` | report |
| `monthly-marketing-review` | brand, strategy, social, website, reputation | `monthly_marketing_review_v1` | report, recommendations |

### Sample global facts

```json
{
  "key": "primary-growth-goal",
  "title": "Primary Growth Goal",
  "content": "Increase qualified leads from organic search by 20% year over year."
}
```

### Sample domain facts (website)

```json
{
  "domainKey": "website",
  "key": "target-word-count",
  "title": "Target Word Count",
  "content": "Service pages should exceed 600 words."
}
```

### Sample instructions

```json
{
  "domainKey": "website",
  "actionKey": "audit",
  "title": "SEO Audit Instructions",
  "content": "Focus on technical SEO, Core Web Vitals, and title tag coverage."
}
```

---

## Package: `seo`

File: `packages/package-manifests/seo/manifest.json`

Domains: `website`, `competitor`, `strategy`

Workflows: `seo-audit` only.

---

## Package: `social-growth`

File: `packages/package-manifests/social-growth/manifest.json`

Domains: `social`, `brand`, `strategy`

Workflows: `monthly-marketing-review` (social sections only — same analysisSpec, subset of domains).

---

## Package: `competitive-intelligence`

File: `packages/package-manifests/competitive-intelligence/manifest.json`

Domains: `competitor`, `website`, `reputation`, `social`

Workflows: `competitive-gap-analysis`

---

## Install steps (Phase 9)

1. Manifest JSON files live under `packages/package-manifests/<packageKey>/manifest.json`.
2. Register catalog entries (one-time per environment):

```bash
npm run package-catalog:seed
```

   Or register a single manifest via MiddlewareAdmin:

```bash
curl -X POST "$API/platform/packages" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"manifest": { ... }, "published": true}'
```

3. Install into a workspace:

```bash
curl -X POST "$API/packages/install" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"workspaceId":"...","packageKey":"marketing-intelligence"}'
```

   `installPackage()` creates domains, facts, instructions, and bundled workflows (`analysisSpecKey`, `workflowKey`, `sourcePackageId`).

4. Export / compare include `workflows[]` for workflows where `sourcePackageId` matches the installed package.

---

## Verification

After install on a test workspace:

```bash
curl -X GET "$API/domains?workspaceId=$WS" -H "Authorization: Bearer $TOKEN"
# Expect 6 domains for marketing-intelligence

curl -X GET "$API/workflows?workspaceId=$WS" -H "Authorization: Bearer $TOKEN"
# Expect 3 workflows with analysisSpecKey in metadata
```
