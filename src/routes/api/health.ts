import { createFileRoute } from '@tanstack/react-router'

// Server route (no UI): a liveness probe for load balancers and platform
// health checks, served by whichever runtime Nitro targets.
export const Route = createFileRoute('/api/health')({
  server: {
    handlers: {
      GET: () =>
        Response.json(
          { status: 'ok' },
          { headers: { 'cache-control': 'no-store' } },
        ),
    },
  },
})
