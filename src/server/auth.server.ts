import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

import type { AuthUser } from '#/lib/types'

// Server half of Better Auth. `handler` proxies /api/auth/* to the Better
// Auth routes on the Convex deployment (so session cookies stay first-party),
// and `getToken` reads the Convex JWT for the current request's session.
// VITE_* values are public and inlined at build time, same as on the client.
export const { handler, getToken, fetchAuthQuery, fetchAuthMutation } =
  convexBetterAuthReactStart({
    convexUrl: import.meta.env.VITE_CONVEX_URL,
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL,
  })

// The user fields Better Auth puts in the Convex JWT. `getToken` mints the
// token fresh for each request, so a name change shows up right away. The
// token comes straight from our auth backend, so it's decoded, not verified;
// only use this for display, never for authorization.
export function userFromToken(token: string): AuthUser {
  const payload = token.split('.')[1] ?? ''
  const claims: Record<string, unknown> = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  )
  return {
    name: typeof claims.name === 'string' ? claims.name.trim() : '',
    email: typeof claims.email === 'string' ? claims.email : '',
  }
}
