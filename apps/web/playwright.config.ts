import { defineConfig, devices } from '@playwright/test'

import { E2E } from './e2e/state.mjs'

// Browser tests: `pnpm --filter web e2e` (or `pnpm test:e2e` from the root).
// They run against a throwaway local Convex backend and a build of the app
// on port 3100 (e2e/server.mjs), never the dev deployment.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: E2E.siteUrl,
    // On a failure: a screenshot and a trace (`pnpm exec playwright show-trace`).
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node e2e/server.mjs',
    url: `${E2E.siteUrl}/api/health`,
    // A server started with `pnpm --filter web e2e:server` is reused, which
    // skips the backend download, deploy and build between runs.
    reuseExistingServer: !process.env.CI,
    timeout: 600_000,
    stdout: 'pipe',
  },
})
