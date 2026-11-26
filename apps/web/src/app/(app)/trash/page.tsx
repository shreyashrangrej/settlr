import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '@settlr/backend/convex/_generated/api'
import { TrashView } from './view'

export const metadata: Metadata = { title: 'Trash · Settlr' }

// SSR: full. Expenses you deleted in the last 30 days, to restore.
export default async function TrashPage() {
  const list = await prefetchQuery(api.trash.list, {})
  return (
    <Prefetched queries={[list.entry]}>
      <TrashView />
    </Prefetched>
  )
}
