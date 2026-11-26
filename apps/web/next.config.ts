import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The browser tests build into their own folder (e2e/server.mjs), so they
  // never clash with `pnpm dev` or `pnpm build`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The Better Auth component ships ESM that has to go through Next's
  // compiler rather than be required by Node directly. `@settlr/shared` is
  // TypeScript source from this monorepo.
  transpilePackages: ['@convex-dev/better-auth', '@settlr/shared'],
}

export default nextConfig
