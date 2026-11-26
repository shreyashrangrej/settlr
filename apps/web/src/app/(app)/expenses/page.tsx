import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { currentMonth } from '@settlr/shared/format'
import { allExpensesSearchSchema } from '@settlr/shared/schemas'
import { parseSearch } from '#/lib/search'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '@settlr/backend/convex/_generated/api'
import { AllExpensesView } from './view'

export const metadata: Metadata = { title: 'All expenses · Settlr' }

type Props = { searchParams: Promise<Record<string, string | Array<string> | undefined>> }

// SSR: full. Every expense you're part of (groups, friends, personal), one
// month at a time (`?month=2026-09`; no param means this month, resolved
// here so the server and client agree). The filters, sort and list length
// are in the URL too.
export default async function AllExpensesPage({ searchParams }: Props) {
  const thisMonth = currentMonth()
  const search = parseSearch(allExpensesSearchSchema, await searchParams)
  const month = search.month || thisMonth
  // Same key order as the view's query, which Convex hashes.
  const expenses = await prefetchQuery(api.expenses.month, {
    month,
    q: search.q,
    category: search.category,
    source: search.source,
    sort: search.sort,
    order: search.order,
    limit: search.limit,
    tag: search.tag,
  })
  return (
    <Prefetched queries={[expenses.entry]}>
      <AllExpensesView month={month} thisMonth={thisMonth} search={search} />
    </Prefetched>
  )
}
