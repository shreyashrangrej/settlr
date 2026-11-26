import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { todayIsoDate } from '@settlr/shared/format'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '@settlr/backend/convex/_generated/api'
import { RecurringView } from './view'

export const metadata: Metadata = { title: 'Recurring · Settlr' }

// SSR: full. Expenses that repeat (rent, subscriptions), added on each due
// date by a daily job.
export default async function RecurringPage() {
  const list = await prefetchQuery(api.recurring.list, {})
  return (
    <Prefetched queries={[list.entry]}>
      <RecurringView today={todayIsoDate()} />
    </Prefetched>
  )
}
