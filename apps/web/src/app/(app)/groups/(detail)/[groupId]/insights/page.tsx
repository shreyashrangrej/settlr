import type { Metadata } from 'next'

import { ClientOnly } from '#/components/client-only'
import { InsightsSkeleton } from '#/components/skeletons'
import { InsightsView } from './view'

export const metadata: Metadata = { title: 'Insights · Settlr' }

// Rendered in the browser only. The group is already loaded by the layout
// (its totals are kept on the group document), but everything here is
// formatted in the viewer's own locale, time zone and clock ("3 days ago"),
// which the server cannot know and would otherwise cause hydration
// mismatches. The server sends the skeleton in its place.
export default function InsightsPage() {
  return (
    <ClientOnly fallback={<InsightsSkeleton />}>
      <InsightsView />
    </ClientOnly>
  )
}
