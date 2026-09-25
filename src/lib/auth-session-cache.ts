import type { AuthUser } from './types'

// The auth session the root route loads in `beforeLoad`. On the server it is
// read fresh for every request. In the browser, fetching it on every
// navigation would put a server round trip in front of each page change, so
// it's kept here for a few minutes. Signing in or out and changing your name
// clear it (see auth-client.ts), so those take effect at once. Convex gets
// its own tokens from the auth client, so a cached session never sends stale
// credentials.

export type AuthSession = { token: string | null; user: AuthUser | null }

const TTL_MS = 5 * 60_000

let cached: { session: AuthSession; at: number } | null = null

export function readCachedSession(): AuthSession | null {
  if (typeof window === 'undefined') return null
  if (!cached || Date.now() - cached.at > TTL_MS) return null
  return cached.session
}

export function writeCachedSession(session: AuthSession) {
  // Never on the server: module state there is shared between requests.
  if (typeof window === 'undefined') return
  cached = { session, at: Date.now() }
}

export function clearCachedSession() {
  cached = null
}
