// Types for state.mjs, which stays plain JavaScript so server.mjs runs on
// Node without a build step.

export declare const STATE_DIR: string
export declare const E2E: {
  convexPort: number
  sitePort: number
  webPort: number
  convexUrl: string
  siteProxyUrl: string
  siteUrl: string
}
export declare function writeAdmin(admin: { url: string; adminKey: string }): void
export declare function readAdmin(): { url: string; adminKey: string }
