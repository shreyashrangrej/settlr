import { convexBetterAuthReactStart } from '@convex-dev/better-auth/react-start'

// Server half of Better Auth. `handler` proxies /api/auth/* to the Better
// Auth routes on the Convex deployment (so session cookies stay first-party),
// and `getToken` reads the Convex JWT for the current request's session.
// VITE_* values are public and inlined at build time, same as on the client.
export const { handler, getToken, fetchAuthQuery, fetchAuthMutation } =
  convexBetterAuthReactStart({
    convexUrl: import.meta.env.VITE_CONVEX_URL,
    convexSiteUrl: import.meta.env.VITE_CONVEX_SITE_URL,
  })
