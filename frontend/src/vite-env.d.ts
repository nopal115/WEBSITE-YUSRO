/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_MAX_RECORDING_MS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
