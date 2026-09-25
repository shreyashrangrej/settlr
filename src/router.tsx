import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'

import { PageSkeleton } from './components/skeletons'
import { ErrorState, NotFound } from './components/states'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL
  if (!convexUrl) throw new Error('VITE_CONVEX_URL is not set')

  // Convex queries run through TanStack Query: loaders prefetch them (over
  // HTTP during SSR, with the session's token), the results are dehydrated
  // into the HTML, and in the browser each one becomes a live WebSocket
  // subscription. Mutations need no refetching; every page updates itself.
  // `expectAuth` waits for the auth token before running queries, so
  // signed-in users never see a signed-out flash.
  const convexQueryClient = new ConvexQueryClient(convexUrl, { expectAuth: true })
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  })
  convexQueryClient.connect(queryClient)

  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      convexQueryClient,
      convexClient: convexQueryClient.convexClient,
    },
    scrollRestoration: true,
    defaultPreload: 'intent',
    // Query data is kept fresh by Convex, so the router needn't re-run
    // loaders to refresh it.
    defaultPreloadStaleTime: 0,
    // Show a page-shaped skeleton if a route takes more than 150ms to load
    // (the router's default wait is 1s), and keep it up for at least 200ms
    // so it doesn't flicker. Routes set their own shape with
    // `pendingComponent`. Also rendered on the server for routes with
    // `ssr: false`/`'data-only'`.
    defaultPendingComponent: PageSkeleton,
    defaultPendingMs: 150,
    defaultPendingMinMs: 200,
    defaultErrorComponent: ErrorState,
    defaultNotFoundComponent: NotFound,
  })

  // Wraps the app in a QueryClientProvider and streams query results from
  // the server render to the client.
  setupRouterSsrQueryIntegration({ router, queryClient })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
