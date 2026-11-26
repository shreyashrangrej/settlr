import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { currentMonth, shiftMonth } from '@settlr/shared/format'
import { monthSearchSchema } from '@settlr/shared/schemas'
import { parseSearch } from '#/lib/search'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '@settlr/backend/convex/_generated/api'
import { recapArgs } from './args'
import { RecapView } from './view'

export const metadata: Metadata = { title: 'Monthly recap · Settlr' }

type Props = { searchParams: Promise<Record<string, string | Array<string> | undefined>> }

// SSR: full. A month in review next to the month before: what you spent,
// where, the biggest expense. `?month=2026-09` picks it (none: last month
// is the usual one to look back on, but this month works as it goes).
export default async function RecapPage({ searchParams }: Props) {
  const thisMonth = currentMonth()
  const month = parseSearch(monthSearchSchema, await searchParams).month || thisMonth
  const queries = await Promise.all([
    prefetchQuery(api.expenses.month, recapArgs(month)),
    prefetchQuery(api.expenses.month, recapArgs(shiftMonth(month, -1))),
  ])
  return (
    <Prefetched queries={queries.map((q) => q.entry)}>
      <RecapView month={month} thisMonth={thisMonth} />
    </Prefetched>
  )
}
