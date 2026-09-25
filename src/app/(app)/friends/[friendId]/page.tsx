import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Prefetched } from '#/components/prefetched'
import { listSearchSchema } from '#/lib/schemas'
import { parseSearch } from '#/lib/search'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { FriendView } from './view'

type Props = {
  params: Promise<{ friendId: string }>
  searchParams: Promise<Record<string, string | Array<string> | undefined>>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { friendId } = await params
  const { data: friend } = await prefetchQuery(api.friends.get, { friendId })
  return friend ? { title: `${friend.name} · Settlr` } : {}
}

// SSR: full. The friend and their ledger are prefetched on the server, then
// stay live. `limit` (the "show more" size) lives in the URL.
export default async function FriendPage({ params, searchParams }: Props) {
  const { friendId } = await params
  const { limit } = parseSearch(listSearchSchema, await searchParams)
  const [friend, ledger] = await Promise.all([
    prefetchQuery(api.friends.get, { friendId }),
    prefetchQuery(api.friends.entries, { friendId, limit }),
  ])
  if (!friend.data) notFound()
  return (
    <Prefetched queries={[friend.entry, ledger.entry]}>
      <FriendView friendId={friendId} limit={limit} />
    </Prefetched>
  )
}
