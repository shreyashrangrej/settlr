import { defineConfig } from 'vitest/config'

// Backend tests: convex-test runs the real queries and mutations against an
// in-memory Convex, in the edge runtime Convex functions run in.
export default defineConfig({
  test: {
    environment: 'edge-runtime',
    include: ['convex/**/*.test.ts'],
    server: { deps: { inline: ['convex-test'] } },
  },
})
