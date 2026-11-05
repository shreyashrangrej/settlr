'use client'

import { useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'

/** A Convex query result fetched by a server component (see convex.server.ts). */
export type PrefetchedQuery = { queryKey: ReadonlyArray<unknown>; data: unknown }

/**
 * Seeds query results a server component prefetched into this browser's
 * TanStack Query cache before its children render, so their
 * `useSuspenseQuery(convexQuery(...))` calls find the data (during SSR too)
 * instead of suspending. Queries the cache already has are left alone:
 * their live Convex subscription is at least as fresh as the server's copy.
 */
export function Prefetched({
  queries,
  children,
}: {
  queries: Array<PrefetchedQuery>
  children: React.ReactNode
}) {
  const queryClient = useQueryClient()
  const seeded = useRef<Array<PrefetchedQuery> | null>(null)
  if (seeded.current !== queries) {
    seeded.current = queries
    for (const { queryKey, data } of queries) {
      if (queryClient.getQueryData(queryKey) === undefined) {
        queryClient.setQueryData(queryKey, data)
      }
    }
  }
  return children
}
