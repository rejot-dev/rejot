/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly HELLO: string;
  readonly NODE_ENV: string;
  readonly SSR: string;

  // Backend stuff
  readonly BACKEND_BASIC_HOST: string;
  readonly BACKEND_BASIC_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
