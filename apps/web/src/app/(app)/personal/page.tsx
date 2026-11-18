import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { currentMonth } from '@settlr/shared/format'
import { personalSearchSchema } from '@settlr/shared/schemas'
import { parseSearch } from '#/lib/search'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '@settlr/backend/convex/_generated/api'
import { PersonalView } from './view'

export const metadata: Metadata = { title: 'Personal expenses · Settlr' }

type Props = { searchParams: Promise<Record<string, string | Array<string> | undefined>> }

// SSR: full. Your own spending, one month at a time (`?month=2026-09`; no
// param means this month). "This month" is resolved here, on the server,
// and passed down, so the server and client render the same month. The
// list's filters and sort are in the URL too; they narrow the month's
// expenses, which are all loaded, so the totals still cover the month.
export default async function PersonalPage({ searchParams }: Props) {
  const thisMonth = currentMonth()
  const search = parseSearch(personalSearchSchema, await searchParams)
  const month = search.month || thisMonth
  const personal = await prefetchQuery(api.personal.month, { month })
  return (
    <Prefetched queries={[personal.entry]}>
      <PersonalView month={month} thisMonth={thisMonth} search={search} />
    </Prefetched>
  )
}
