import { handler } from '#/server/auth.server'

// Better Auth's endpoints (email codes, Google OAuth callback, session),
// forwarded to the Convex deployment.
export const { GET, POST } = handler
