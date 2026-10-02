/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_APP_NAME?: string;
  readonly VITE_MAX_RECORDING_MS?: string;
  /** 'true' hanya untuk pengembangan: request diteruskan ke data tiruan di lib/api/mock. */
  readonly VITE_USE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
