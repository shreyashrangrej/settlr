import { createServerFn } from '@tanstack/react-start'

import { getToken, userFromToken } from '#/server/auth.server'

// The Convex auth token for the current session and the signed-in user, or
// nulls when signed out. The root route loads it so SSR knows who is signed
// in (and whether they still need to give their name).
export const getAuthSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const token = (await getToken()) ?? null
    return { token, user: token ? userFromToken(token) : null }
  },
)
