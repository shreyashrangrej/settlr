import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { currentMonth, todayIsoDate } from '#/lib/format'
import { monthSearchSchema } from '#/lib/schemas'
import { parseSearch } from '#/lib/search'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { BudgetView } from './view'

export const metadata: Metadata = { title: 'Monthly budget · Settlr' }

type Props = { searchParams: Promise<Record<string, string | Array<string> | undefined>> }

// SSR: full. The monthly budget, on its own page because it covers all your
// spending: personal expenses plus your share with friends and in groups.
// `?month=2026-09` picks the month (none means this month); like the
// personal page, "this month" and "today" are resolved here once.
export default async function BudgetPage({ searchParams }: Props) {
  const thisMonth = currentMonth()
  const month = parseSearch(monthSearchSchema, await searchParams).month || thisMonth
  const queries = await Promise.all([
    prefetchQuery(api.budgets.list, {}),
    prefetchQuery(api.budgets.monthSpending, { month }),
  ])
  return (
    <Prefetched queries={queries.map((q) => q.entry)}>
      <BudgetView month={month} thisMonth={thisMonth} today={todayIsoDate()} />
    </Prefetched>
  )
}
