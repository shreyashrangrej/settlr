import { createRouter as createTanStackRouter } from '@tanstack/react-router'

import { ErrorState, NotFound, PageSpinner } from './components/states'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
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
