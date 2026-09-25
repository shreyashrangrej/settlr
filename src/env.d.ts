/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Convex deployment URLs, written to .env.local by `convex dev`.
  readonly VITE_CONVEX_URL: string
  readonly VITE_CONVEX_SITE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
