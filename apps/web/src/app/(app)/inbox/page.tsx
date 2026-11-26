import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '@settlr/backend/convex/_generated/api'
import { InboxView } from './view'

export const metadata: Metadata = { title: 'Inbox · Settlr' }

// SSR: full. Receipts and bills you forwarded by email, read into drafts.
export default async function InboxPage() {
  const queries = await Promise.all([
    prefetchQuery(api.inbox.list, {}),
    prefetchQuery(api.profiles.me, {}),
  ])
  return (
    <Prefetched queries={queries.map((q) => q.entry)}>
      <InboxView />
    </Prefetched>
  )
}
