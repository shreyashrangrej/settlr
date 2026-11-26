import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

// Unit tests for the app's plain logic (src/lib): money, splits, the keypad.
// Screens are covered by the browser tests in e2e/.
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
