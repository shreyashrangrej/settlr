import { execFileSync } from 'node:child_process'
import type { NextConfig } from 'next'

// The commit this build is from, for /api/health and Settings: Vercel says
// which, otherwise git does; empty when neither knows.
function commitSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return ''
  }
}

const nextConfig: NextConfig = {
  // The browser tests build into their own folder (e2e/server.mjs), so they
  // never clash with `pnpm dev` or `pnpm build`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The Better Auth component ships ESM that has to go through Next's
  // compiler rather than be required by Node directly. `@settlr/shared` is
  // TypeScript source from this monorepo.
  transpilePackages: ['@convex-dev/better-auth', '@settlr/shared'],
  env: { NEXT_PUBLIC_COMMIT_SHA: commitSha() },
}

export default nextConfig
