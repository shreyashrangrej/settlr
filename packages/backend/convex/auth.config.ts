import { getAuthConfigProvider } from '@convex-dev/better-auth/auth-config'
import type { AuthConfig } from 'convex/server'

// Lets Convex verify the JWTs Better Auth issues, so `ctx.auth` works in
// queries and mutations. Without this file every request is signed out.
export default {
  providers: [getAuthConfigProvider()],
} satisfies AuthConfig
