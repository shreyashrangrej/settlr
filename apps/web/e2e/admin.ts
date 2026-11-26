import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readAdmin, STATE_DIR } from './state.mjs'

const CLI = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../packages/backend/node_modules/convex/bin/main.js',
)

/** Runs the Convex CLI against the test backend as its admin. */
function convex(args: Array<string>) {
  const { url, adminKey } = readAdmin()
  const result = spawnSync('node', [CLI, ...args], {
    // Not packages/backend, whose .env.local points at the dev deployment.
    cwd: STATE_DIR,
    env: {
      ...process.env,
      CONVEX_DEPLOYMENT: '',
      CONVEX_SELF_HOSTED_URL: url,
      CONVEX_SELF_HOSTED_ADMIN_KEY: adminKey,
    },
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(`convex ${args.join(' ')} failed:\n${result.stderr}`)
  return result.stdout
}

/**
 * The sign-in code last sent to `email`. The test backend has no Resend
 * key, so codes are only stored (Better Auth's `verification` table).
 */
export function signInCode(email: string) {
  const out = convex([
    'data',
    '--component',
    'betterAuth',
    'verification',
    '--format',
    'jsonl',
    '--limit',
    '50',
  ])
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const row = JSON.parse(line) as { identifier: string; value: string }
    if (row.identifier === `sign-in-otp-${email}`) return row.value.split(':')[0]
  }
  return null
}
