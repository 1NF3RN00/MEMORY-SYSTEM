import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      [
        "/access",
        "/auth",
        "/platform",
        "/workspaces",
        "/health",
        "/ingest",
        "/ingestion",
        "/memory",
        "/events",
        "/retrieve",
        "/retrieval",
        "/compress",
        "/compression",
        "/context",
        "/relationships",
        "/history",
        "/replay",
        "/historian",
        "/diagnostics",
        "/calibration",
        "/augmentation",
        "/clusters",
        "/search",
        "/packages",
        "/domains",
        "/global-facts",
        "/domain-facts",
        "/instructions",
        "/objects",
        "/workflows",
        "/workflow-runs",
        "/observations",
        "/observation-providers",
        "/observation-metrics",
      ].map((path) => [path, "http://localhost:3000"]),
    ),
  },
});
