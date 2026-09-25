import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { FriendsView } from './view'

export const metadata: Metadata = { title: 'Friends · Settlr' }

// SSR: full. The friends list is prefetched on the server; in the browser it
// stays subscribed, so balances update live.
export default async function FriendsPage() {
  const friends = await prefetchQuery(api.friends.list, {})
  return (
    <Prefetched queries={[friends.entry]}>
      <FriendsView />
    </Prefetched>
  )
}
