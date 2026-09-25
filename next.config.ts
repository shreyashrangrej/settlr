import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // The Better Auth component ships ESM that has to go through Next's
  // compiler rather than be required by Node directly.
  transpilePackages: ['@convex-dev/better-auth'],
}

export default nextConfig
