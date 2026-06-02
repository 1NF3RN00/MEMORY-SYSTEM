import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/ingest": "http://localhost:3000",
      "/ingestion": "http://localhost:3000",
      "/memory": "http://localhost:3000",
      "/events": "http://localhost:3000",
      "/workspaces": "http://localhost:3000",
      "/health": "http://localhost:3000",
      "/retrieve": "http://localhost:3000",
      "/retrieval": "http://localhost:3000",
      "/compress": "http://localhost:3000",
      "/compression": "http://localhost:3000",
      "/context": "http://localhost:3000",
      "/relationships": "http://localhost:3000",
      "/history": "http://localhost:3000",
      "/replay": "http://localhost:3000",
      "/historian": "http://localhost:3000",
      "/diagnostics": "http://localhost:3000",
      "/calibration": "http://localhost:3000",
      "/augmentation": "http://localhost:3000",
      "/clusters": "http://localhost:3000",
    },
  },
});
