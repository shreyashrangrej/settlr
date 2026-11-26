// Ports and paths the browser tests share: server.mjs starts things here,
// the tests (via admin.ts) talk to them.

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const STATE_DIR = join(dirname(fileURLToPath(import.meta.url)), '.state')

const convexPort = 3310
const sitePort = 3311
const webPort = 3100

export const E2E = {
  convexPort,
  sitePort,
  webPort,
  convexUrl: `http://127.0.0.1:${convexPort}`,
  siteProxyUrl: `http://127.0.0.1:${sitePort}`,
  siteUrl: `http://localhost:${webPort}`,
}

const ENV_FILE = join(STATE_DIR, 'convex.env')

/** Saves how to reach the backend as an admin, in the CLI's env-file format. */
export function writeAdmin({ url, adminKey }) {
  writeFileSync(ENV_FILE, `CONVEX_SELF_HOSTED_URL=${url}\nCONVEX_SELF_HOSTED_ADMIN_KEY=${adminKey}\n`)
}

/** @returns {{ url: string, adminKey: string }} */
export function readAdmin() {
  const text = readFileSync(ENV_FILE, 'utf8')
  const get = (name) => text.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1] ?? ''
  return { url: get('CONVEX_SELF_HOSTED_URL'), adminKey: get('CONVEX_SELF_HOSTED_ADMIN_KEY') }
}
