import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_PERF_API_PROXY ?? "http://localhost:3000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/perf": apiTarget,
      "/health": apiTarget,
    },
  },
});
