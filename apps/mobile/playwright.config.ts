import { defineConfig, devices } from '@playwright/test'

// Browser tests of the Android app: `pnpm --filter mobile e2e`. They run its
// web build at a Pixel's size against the throwaway local Convex backend
// from apps/web/e2e (e2e/server.mjs), never the dev deployment.
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://localhost:3200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'pixel', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'node e2e/server.mjs',
    url: 'http://localhost:3200',
    reuseExistingServer: !process.env.CI,
    timeout: 900_000,
    stdout: 'pipe',
  },
})
