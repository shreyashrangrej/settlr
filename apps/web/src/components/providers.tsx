'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { ConvexBetterAuthProvider } from '@convex-dev/better-auth/react'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { usePathname } from 'next/navigation'

import { authClient } from '#/lib/auth-client'
import type { AuthUser } from '#/lib/types'

export type Session = { token: string | null; user: AuthUser | null }

const SessionContext = createContext<Session>({ token: null, user: null })

/**
 * The signed-in user, from the root layout (null when signed out). It's
 * read on the server for every request, so the server and first client
 * render agree; `router.refresh()` loads it again.
 */
export function useSession() {
  return useContext(SessionContext)
}

// How many pages this tab has shown in the app, so the back button knows
// whether "back" stays inside it.
let pagesVisited = 0
export function canGoBack() {
  return pagesVisited > 1
}

function PageCounter() {
  const pathname = usePathname()
  useEffect(() => {
    pagesVisited += 1
  }, [pathname])
  return null
}

/**
 * Convex queries run through TanStack Query: server components prefetch
 * them with the visitor's token (src/server/convex.server.ts) and
 * <Prefetched> seeds the results here; in the browser each query becomes a
 * live WebSocket subscription, so pages update themselves after a mutation
 * or a change in another tab, with no refetching. `expectAuth` waits for the
 * auth token before running queries, so signed-in users never see a
 * signed-out flash.
 */
export function Providers({
  session,
  children,
}: {
  session: Session
  children: React.ReactNode
}) {
  // One set of clients per browser tab (and per request during SSR).
  const [{ convexQueryClient, queryClient }] = useState(() => {
    const convexQueryClient = new ConvexQueryClient(process.env.NEXT_PUBLIC_CONVEX_URL, {
      expectAuth: true,
    })
    // During SSR, anything not prefetched runs over HTTP as this user.
    if (session.token) convexQueryClient.serverHttpClient?.setAuth(session.token)
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          queryKeyHashFn: convexQueryClient.hashFn(),
          queryFn: convexQueryClient.queryFn(),
        },
      },
    })
    convexQueryClient.connect(queryClient)
    return { convexQueryClient, queryClient }
  })

  return (
    <ConvexBetterAuthProvider
      client={convexQueryClient.convexClient}
      authClient={authClient}
      initialToken={session.token}
    >
      <QueryClientProvider client={queryClient}>
        <SessionContext value={session}>
          <PageCounter />
          {children}
        </SessionContext>
      </QueryClientProvider>
    </ConvexBetterAuthProvider>
  )
}
