import type { Metadata } from 'next'

import { ClientOnly } from '#/components/client-only'
import { TableSkeleton } from '#/components/skeletons'
import { ActivityView } from './view'

export const metadata: Metadata = { title: 'Activity · Settlr' }

// Browser only: times are shown in the viewer's own time zone.
export default function ActivityPage() {
  return (
    <ClientOnly fallback={<TableSkeleton />}>
      <ActivityView />
    </ClientOnly>
  )
}
