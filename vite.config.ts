import { defineConfig } from 'vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import tailwindcss from '@tailwindcss/vite'
import viteReact from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  // The Better Auth component ships ESM that must go through Vite's SSR
  // transform rather than be loaded by Node directly.
  ssr: { noExternal: ['@convex-dev/better-auth'] },
  plugins: [
    // Nitro packages the server for the deployment runtime. The target is
    // picked at build time with NITRO_PRESET (node-server by default; e.g.
    // vercel, netlify, cloudflare-module, bun, aws-lambda) and needs no
    // changes to application code.
    nitro(),
    tanstackStart({
      // `*.server.*` files and modules importing
      // '@tanstack/react-start/server-only' may never reach the client bundle
      // (and `*.client.*` never the server). Violations fail production
      // builds; in dev they are reported and mocked so HMR keeps working.
      importProtection: {
        behavior: { dev: 'mock', build: 'error' },
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
})

export default config
