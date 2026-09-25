import 'server-only'

import { cache } from 'react'
import {
  getFunctionName,
  makeFunctionReference,
  type FunctionReference,
} from 'convex/server'

import type { PrefetchedQuery } from '#/components/prefetched'
import { fetchAuthQuery } from './auth.server'

// Server components prefetch Convex queries here, as the signed-in user, and
// hand the results to <Prefetched> (src/components/prefetched.tsx), which
// seeds them into the browser's TanStack Query cache. Components then read
// them with `useSuspenseQuery(convexQuery(...))` as usual, and in the browser
// each one becomes a live subscription.

// One fetch per query and arguments per request, so a page and its
// `generateMetadata` can both ask. Keyed by strings: `cache` compares
// arguments by identity.
const run = cache(async (name: string, argsJson: string) =>
  fetchAuthQuery(makeFunctionReference<'query'>(name), JSON.parse(argsJson)),
)

/**
 * Runs a Convex query for the page being rendered. Returns its result and
 * the entry to pass to <Prefetched>, keyed exactly like `convexQuery()`.
 */
export async function prefetchQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  args: Query['_args'],
): Promise<{ data: Query['_returnType']; entry: PrefetchedQuery }> {
  const name = getFunctionName(query)
  const data = (await run(name, JSON.stringify(args))) as Query['_returnType']
  return { data, entry: { queryKey: ['convexQuery', name, args], data } }
}
