import type { Metadata } from 'next'

import { Prefetched } from '#/components/prefetched'
import { currentMonth } from '#/lib/format'
import { monthSearchSchema } from '#/lib/schemas'
import { parseSearch } from '#/lib/search'
import { prefetchQuery } from '#/server/convex.server'
import { api } from '#convex/_generated/api'
import { PersonalView } from './view'

export const metadata: Metadata = { title: 'Personal expenses · Settlr' }

type Props = { searchParams: Promise<Record<string, string | Array<string> | undefined>> }

// SSR: full. Your own spending, one month at a time (`?month=2026-09`; no
// param means this month). "This month" is resolved here, on the server,
// and passed down, so the server and client render the same month.
export default async function PersonalPage({ searchParams }: Props) {
  const thisMonth = currentMonth()
  const month = parseSearch(monthSearchSchema, await searchParams).month || thisMonth
  const personal = await prefetchQuery(api.personal.month, { month })
  return (
    <Prefetched queries={[personal.entry]}>
      <PersonalView month={month} thisMonth={thisMonth} />
    </Prefetched>
  )
}
