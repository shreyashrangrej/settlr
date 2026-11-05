declare namespace NodeJS {
  interface ProcessEnv {
    // Convex deployment URLs, written to .env.local by `convex dev`.
    readonly NEXT_PUBLIC_CONVEX_URL: string
    readonly NEXT_PUBLIC_CONVEX_SITE_URL: string
  }
}
