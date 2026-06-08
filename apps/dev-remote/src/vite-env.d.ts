/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PERF_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
