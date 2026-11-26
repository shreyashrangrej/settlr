// Starts everything the browser tests run against, isolated from the dev
// deployment: a fresh local Convex backend (open-source binary, downloaded
// once into e2e/.state), with packages/backend/convex pushed to it, and the
// web app built against it and served on http://localhost:3100.
//
// Playwright runs this as its webServer (see playwright.config.ts) and stops
// it afterwards; `pnpm --filter web e2e:server` runs it by hand so repeated
// test runs can reuse it. `E2E_DEV=1` serves with `next dev` instead of a
// production build (faster to start, slower per page).

import { execFileSync, spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, openSync, rmSync, writeFileSync } from 'node:fs'
import { arch, platform } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { E2E, STATE_DIR, writeAdmin } from './state.mjs'

const WEB_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND_PKG = join(WEB_DIR, '../../packages/backend')

// A pinned build of github.com/convex/convex-backend, so runs are repeatable.
// Bump it now and then (any `precompiled-*` release tag).
const BACKEND_VERSION = 'precompiled-2026-11-25-f1fe37b'
const INSTANCE_NAME = 'settlr-e2e'

const children = []
function stopAll() {
  for (const child of children) if (child.exitCode === null) child.kill()
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    stopAll()
    process.exit(0)
  })
}
process.on('exit', stopAll)

function log(message) {
  console.log(`[e2e] ${message}`)
}

function binaryAsset() {
  const cpu = arch() === 'arm64' ? 'aarch64' : 'x86_64'
  if (platform() === 'darwin') return `convex-local-backend-${cpu}-apple-darwin.zip`
  if (platform() === 'win32') return 'convex-local-backend-x86_64-pc-windows-msvc.zip'
  return `convex-local-backend-${cpu}-unknown-linux-gnu.zip`
}

async function ensureBinary() {
  const dir = join(STATE_DIR, 'bin', BACKEND_VERSION)
  const binary = join(dir, platform() === 'win32' ? 'convex-local-backend.exe' : 'convex-local-backend')
  if (existsSync(binary)) return binary
  mkdirSync(dir, { recursive: true })
  const url = `https://github.com/convex/convex-backend/releases/download/${BACKEND_VERSION}/${binaryAsset()}`
  log(`downloading the Convex backend (${BACKEND_VERSION}), once`)
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`)
  const zip = join(dir, 'backend.zip')
  writeFileSync(zip, Buffer.from(await response.arrayBuffer()))
  // Windows and macOS ship bsdtar, which reads zips; Linux has unzip.
  if (platform() === 'linux') execFileSync('unzip', ['-o', '-q', zip, '-d', dir])
  else execFileSync('tar', ['-xf', zip, '-C', dir])
  rmSync(zip)
  if (platform() !== 'win32') chmodSync(binary, 0o755)
  return binary
}

async function waitFor(url, what, timeoutMs = 60_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`${what} didn't start within ${timeoutMs / 1000}s (${url})`)
}

function run(command, args, options) {
  execFileSync(command, args, { stdio: 'inherit', shell: platform() === 'win32', ...options })
}

async function startBackend() {
  const binary = await ensureBinary()
  const dataDir = join(STATE_DIR, 'data')
  rmSync(dataDir, { recursive: true, force: true })
  mkdirSync(dataDir, { recursive: true })

  const instanceSecret = randomBytes(32).toString('hex')
  const adminKey = execFileSync(binary, [
    'keygen',
    'admin-key',
    '--instance-name',
    INSTANCE_NAME,
    '--instance-secret',
    instanceSecret,
  ])
    .toString()
    .trim()

  const logFile = join(STATE_DIR, 'backend.log')
  const out = openSync(logFile, 'w')
  const backend = spawn(
    binary,
    [
      '--port',
      String(E2E.convexPort),
      '--site-proxy-port',
      String(E2E.sitePort),
      '--instance-name',
      INSTANCE_NAME,
      '--instance-secret',
      instanceSecret,
      '--local-storage',
      join(dataDir, 'storage'),
      '--disable-beacon',
      join(dataDir, 'convex.sqlite3'),
    ],
    { stdio: ['ignore', out, out] },
  )
  children.push(backend)
  backend.on('exit', (code) => {
    if (code) log(`the Convex backend exited (${code}); see ${logFile}`)
  })
  await waitFor(`${E2E.convexUrl}/version`, 'The local Convex backend')

  // Set the deployment's env vars before the push: convex.config.ts makes
  // some of them required. No RESEND_API_KEY, so sign-in codes stay in the
  // database, where the tests read them (e2e/admin.ts).
  const response = await fetch(`${E2E.convexUrl}/api/update_environment_variables`, {
    method: 'POST',
    headers: { authorization: `Convex ${adminKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      changes: [
        { name: 'SITE_URL', value: E2E.siteUrl },
        { name: 'TRUSTED_ORIGINS', value: `http://127.0.0.1:${E2E.webPort}` },
        { name: 'BETTER_AUTH_SECRET', value: randomBytes(32).toString('base64') },
      ],
    }),
  })
  if (!response.ok) throw new Error(`Setting env vars failed: ${await response.text()}`)
  writeAdmin({ url: E2E.convexUrl, adminKey })

  log('pushing convex/ to the local backend')
  run(
    'node',
    [
      'node_modules/convex/bin/main.js',
      'deploy',
      '--env-file',
      join(STATE_DIR, 'convex.env'),
      '--codegen',
      'disable',
      '--typecheck',
      'disable',
      '--yes',
    ],
    { cwd: BACKEND_PKG },
  )
}

async function startWeb() {
  const env = {
    ...process.env,
    NEXT_PUBLIC_CONVEX_URL: E2E.convexUrl,
    NEXT_PUBLIC_CONVEX_SITE_URL: E2E.siteProxyUrl,
    // Its own build folder, so it never touches the dev server's `.next`.
    NEXT_DIST_DIR: '.next-e2e',
    NEXT_TELEMETRY_DISABLED: '1',
  }
  const dev = process.env.E2E_DEV === '1'
  if (!dev) {
    log('building the web app')
    run('pnpm', ['exec', 'next', 'build'], { cwd: WEB_DIR, env })
  }
  const web = spawn(
    'pnpm',
    ['exec', 'next', dev ? 'dev' : 'start', '--port', String(E2E.webPort)],
    { cwd: WEB_DIR, env, stdio: 'inherit', shell: platform() === 'win32' },
  )
  children.push(web)
  web.on('exit', (code) => process.exit(code ?? 0))
  await waitFor(`${E2E.siteUrl}/api/health`, 'The web app', 120_000)
  log(`ready on ${E2E.siteUrl}`)
}

mkdirSync(STATE_DIR, { recursive: true })
try {
  await startBackend()
  await startWeb()
} catch (error) {
  console.error(error)
  stopAll()
  process.exit(1)
}
