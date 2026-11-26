// Starts what the Android app's browser tests run against: the throwaway
// local Convex backend from apps/web/e2e (reused if it's already up), and
// this app's web build, served on http://localhost:3200 with /api/auth/*
// forwarded to the backend the way the web app's auth route does it. The
// tests drive the same screens, at a phone's size, in Chromium.
//
// Playwright runs this as its webServer (playwright.config.ts);
// `pnpm --filter mobile e2e:server` runs it by hand so repeated runs reuse it.

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'

import { E2E } from '../../web/e2e/state.mjs'

export const APP_PORT = 3200
const APP_URL = `http://localhost:${APP_PORT}`
const MOBILE_DIR = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const DIST = join(MOBILE_DIR, 'dist-e2e')

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

const log = (message) => console.log(`[mobile e2e] ${message}`)

async function up(url) {
  try {
    return (await fetch(url)).ok
  } catch {
    return false
  }
}

async function waitFor(url, what, timeoutMs) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await up(url)) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`${what} didn't start within ${timeoutMs / 1000}s (${url})`)
}

// Better Auth answers /api/auth/ok once the functions are deployed.
const AUTH_OK = `${E2E.siteProxyUrl}/api/auth/ok`

async function startBackend() {
  if (await up(AUTH_OK)) {
    log('reusing the running test backend')
    return
  }
  log('starting the test backend (apps/web/e2e/server.mjs, backend only)')
  const backend = spawn('node', [join(MOBILE_DIR, '../web/e2e/server.mjs')], {
    env: { ...process.env, E2E_BACKEND_ONLY: '1' },
    stdio: 'inherit',
  })
  children.push(backend)
  backend.on('exit', (code) => {
    if (code) {
      log(`the test backend exited (${code})`)
      process.exit(code)
    }
  })
  await waitFor(AUTH_OK, 'The test backend', 600_000)
}

function buildApp() {
  log('building the app for the web')
  execFileSync('npx', ['expo', 'export', '--platform', 'web', '--output-dir', 'dist-e2e', '--clear'], {
    cwd: MOBILE_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      // These win over .env.local, which points at the dev deployment.
      EXPO_PUBLIC_CONVEX_URL: E2E.convexUrl,
      EXPO_PUBLIC_CONVEX_SITE_URL: E2E.siteProxyUrl,
      // Auth goes through this server, so its cookies are first-party.
      EXPO_PUBLIC_SITE_URL: APP_URL,
      CI: '1',
    },
  })
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
}

/** /api/auth/* to the backend, as @convex-dev/better-auth's Next.js handler does. */
async function proxyAuth(req, res) {
  const target = `${E2E.siteProxyUrl}${req.url}`
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
  }
  for (const name of ['transfer-encoding', 'content-length', 'connection']) headers.delete(name)
  // The backend's SITE_URL is the web app's test origin; requests from this
  // app's own origin go in under it, like the web app's would.
  const site = new URL(E2E.siteUrl)
  headers.set('host', new URL(E2E.siteProxyUrl).host)
  headers.set('origin', site.origin)
  headers.delete('referer')
  headers.set('x-forwarded-host', site.host)
  headers.set('x-forwarded-proto', 'http')
  headers.set('x-better-auth-forwarded-host', site.host)
  headers.set('x-better-auth-forwarded-proto', 'http')
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const response = await fetch(target, { method: req.method, headers, body, redirect: 'manual' })
  const out = {}
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie' && key !== 'content-encoding' && key !== 'content-length') out[key] = value
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length) out['set-cookie'] = cookies
  res.writeHead(response.status, out)
  res.end(Buffer.from(await response.arrayBuffer()))
}

function serveStatic(req, res) {
  const path = normalize(decodeURIComponent(new URL(req.url, APP_URL).pathname)).replace(/^(\.\.[/\\])+/, '')
  let file = join(DIST, path)
  if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
  res.end(readFileSync(file))
}

function serve() {
  const server = createServer((req, res) => {
    if (req.url?.startsWith('/api/auth/')) {
      proxyAuth(req, res).catch((error) => {
        console.error(error)
        res.writeHead(502)
        res.end('Proxy error')
      })
    } else {
      serveStatic(req, res)
    }
  })
  server.listen(APP_PORT, () => log(`ready on ${APP_URL}`))
}

try {
  await startBackend()
  buildApp()
  serve()
} catch (error) {
  console.error(error)
  stopAll()
  process.exit(1)
}
