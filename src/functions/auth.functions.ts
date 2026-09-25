import { createServerFn } from '@tanstack/react-start'

import { getToken } from '#/server/auth.server'

// The Convex auth token for the current session, or undefined when signed
// out. The root route loads it so SSR knows who is signed in.
export const getAuthToken = createServerFn({ method: 'GET' }).handler(
  async () => (await getToken()) ?? null,
)
