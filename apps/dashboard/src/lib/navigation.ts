export interface NavItem {
  to: string;
  label: string;
  end?: boolean;
  keywords?: string[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/", label: "Dashboard", end: true, keywords: ["home", "overview", "operational"] },
      { to: "/how-it-works", label: "How It Works", keywords: ["docs", "architecture"] },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { to: "/ingest", label: "Ingestion", keywords: ["upload", "import"] },
      { to: "/ingestion", label: "Ingestion Traces", keywords: ["ingest", "trace"] },
    ],
  },
  {
    label: "Memory",
    items: [
      { to: "/memory", label: "Memory Explorer", keywords: ["memories", "browse"] },
      { to: "/relationship-map", label: "Relationship Map", keywords: ["graph", "relationships"] },
    ],
  },
  {
    label: "Retrieval",
    items: [
      {
        to: "/retrieval-diagnostics",
        label: "Diagnostics & Calibration",
        keywords: ["calibration", "benchmark"],
      },
      { to: "/retrieval-traces", label: "Observability", keywords: ["retrieval", "traces"] },
      { to: "/planning", label: "Retrieval Planning", keywords: ["plan", "preprocessing"] },
      { to: "/compression-traces", label: "Compression", keywords: ["compress", "tokens"] },
      { to: "/context-delivery", label: "Context Delivery", keywords: ["render", "delivery"] },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/historian", label: "Historian & Replay", keywords: ["replay", "history"] },
      { to: "/observability", label: "System Metrics", keywords: ["metrics", "ops"] },
    ],
  },
  {
    label: "Platform",
    items: [
      { to: "/admin/provisioning", label: "Provisioning", keywords: ["access", "approve", "onboard"] },
      { to: "/admin/api-keys", label: "API Keys", keywords: ["credentials", "middleware"] },
      { to: "/admin/security", label: "Security Events", keywords: ["audit", "auth"] },
    ],
  },
];

export const flatNavItems: NavItem[] = navGroups.flatMap((group) => group.items);

export function filterNavItems(query: string): NavItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return flatNavItems;
  return flatNavItems.filter((item) => {
    const haystack = [item.label, item.to, ...(item.keywords ?? [])].join(" ").toLowerCase();
    return haystack.includes(q);
  });
}
