/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BASE_PATH?: string;
  readonly VITE_SHOW_OFFICIAL_FIGURES?: string;
  readonly VITE_SHOW_RECORDER?: string;
  readonly VITE_SHOW_SCREENSHOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
