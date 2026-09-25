import { createFileRoute } from '@tanstack/react-router'

import { handler } from '#/server/auth.server'

// Server route (no UI): Better Auth's endpoints (email codes, Google OAuth
// callback, session), forwarded to the Convex deployment.
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
})
