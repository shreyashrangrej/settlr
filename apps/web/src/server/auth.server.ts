import 'server-only'

import { convexBetterAuthNextJs } from '@convex-dev/better-auth/nextjs'
import { unstable_rethrow } from 'next/navigation'
import { cache } from 'react'

import type { AuthUser } from '#/lib/types'

// Server half of Better Auth. `handler` proxies /api/auth/* to the Better
// Auth routes on the Convex deployment (so session cookies stay first-party),
// `getToken` reads the Convex JWT for the current request's session, and
// `fetchAuthQuery` runs a Convex query as the signed-in user. The
// `server-only` import fails the build if this reaches a client bundle.
export const { handler, getToken, fetchAuthQuery } = convexBetterAuthNextJs({
  convexUrl: process.env.NEXT_PUBLIC_CONVEX_URL!,
  convexSiteUrl: process.env.NEXT_PUBLIC_CONVEX_SITE_URL!,
})

// The user fields Better Auth puts in the Convex JWT. `getToken` mints the
// token fresh for each request, so a name change shows up right away. The
// token comes straight from our auth backend, so it's decoded, not verified;
// only use this for display, never for authorization.
function userFromToken(token: string): AuthUser {
  const payload = token.split('.')[1] ?? ''
  const claims: Record<string, unknown> = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  )
  return {
    name: typeof claims.name === 'string' ? claims.name.trim() : '',
    email: typeof claims.email === 'string' ? claims.email : '',
  }
}

export type AuthSession = { token: string | null; user: AuthUser | null }

/**
 * The Convex auth token for this request's session and the signed-in user,
 * or nulls when signed out. Cached per request, so the root layout, the
 * signed-in layout and pages can all ask.
 */
export const getAuthSession = cache(async (): Promise<AuthSession> => {
  try {
    const token = (await getToken()) ?? null
    return { token, user: token ? userFromToken(token) : null }
  } catch (error) {
    // Next.js signals dynamic rendering (and redirects) with errors of its
    // own; let those through.
    unstable_rethrow(error)
    // An unreachable auth backend shouldn't take the whole site down;
    // render signed out instead.
    console.error('Could not load the auth session', error)
    return { token: null, user: null }
  }
})
