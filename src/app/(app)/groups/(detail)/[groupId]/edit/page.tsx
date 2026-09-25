import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { EditGroupView } from './view'

export const metadata: Metadata = { title: 'Edit group · Settlr' }

// SSR: full. The form starts from the group the layout already loaded; your
// connected friends are prefetched for linking members to their accounts.
export default async function EditGroupPage() {
  const friends = await prefetchQuery(api.friends.list, {})
  return (
    <Prefetched queries={[friends.entry]}>
      <EditGroupView />
    </Prefetched>
  )
}
