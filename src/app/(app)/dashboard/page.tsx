import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { currentMonth, todayIsoDate } from '#/lib/format'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { DashboardView } from './view'

export const metadata: Metadata = { title: 'Dashboard · Settlr' }

// SSR: full. The signed-in home: one live summary of friends, groups and
// spending. Every query is prefetched in parallel on the server, and the
// month and date are read here so the server and client render the same day.
export default async function DashboardPage() {
  const month = currentMonth()
  const queries = await Promise.all([
    prefetchQuery(api.friends.list, {}),
    prefetchQuery(api.groups.list, {}),
    prefetchQuery(api.personal.month, { month }),
    prefetchQuery(api.budgets.list, {}),
    prefetchQuery(api.budgets.monthSpending, { month }),
  ])
  return (
    <Prefetched queries={queries.map((q) => q.entry)}>
      <DashboardView month={month} today={todayIsoDate()} />
    </Prefetched>
  )
}
