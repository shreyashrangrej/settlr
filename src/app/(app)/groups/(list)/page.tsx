import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { GroupsView } from './view'

export const metadata: Metadata = { title: 'Groups · Settlr' }

// SSR: full. The group list belongs in the first HTML response; after
// hydration it stays live.
export default async function GroupsPage() {
  const groups = await prefetchQuery(api.groups.list, {})
  return (
    <Prefetched queries={[groups.entry]}>
      <GroupsView />
    </Prefetched>
  )
}
