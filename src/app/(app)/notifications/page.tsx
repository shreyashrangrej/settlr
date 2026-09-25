import type { Metadata } from 'next'

import { ClientOnly } from '#/components/client-only'
import { Prefetched } from '#/components/prefetched'
import { PageSkeleton } from '#/components/skeletons'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { NotificationsView } from './view'

export const metadata: Metadata = { title: 'Notifications · Settlr' }

// The list is prefetched on the server, but times are shown relative to the
// viewer's clock ("5 minutes ago"), so it renders in the browser only. The
// header's bell shows the latest few; this page (its "More" link) shows
// everything, centered.
export default async function NotificationsPage() {
  const notifications = await prefetchQuery(api.notifications.list, {})
  return (
    <Prefetched queries={[notifications.entry]}>
      <ClientOnly fallback={<PageSkeleton />}>
        <NotificationsView />
      </ClientOnly>
    </Prefetched>
  )
}
