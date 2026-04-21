/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SITE_ID?: string;
  readonly VITE_CHAT_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
