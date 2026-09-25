import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { ConvexReactClient } from 'convex/react'

import { ErrorState, NotFound, PageSpinner } from './components/states'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL
  if (!convexUrl) throw new Error('VITE_CONVEX_URL is not set')
  // Waits for the auth token before running queries, so signed-in users
  // never see a signed-out flash from Convex.
  const convexClient = new ConvexReactClient(convexUrl, { expectAuth: true })

  const router = createTanStackRouter({
    routeTree,
    context: { convexClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Also rendered on the server for routes with `ssr: false`/`'data-only'`.
    defaultPendingComponent: PageSpinner,
    defaultErrorComponent: ErrorState,
    defaultNotFoundComponent: NotFound,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
